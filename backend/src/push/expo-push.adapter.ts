import { Injectable, Logger } from '@nestjs/common';
import { createPushConfig, type PushConfig } from './push.config';

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const ticketIdPattern = /^[A-Za-z0-9._:-]{1,256}$/;
const ALLOWED_PROVIDER_ERRORS: Record<string, string> = {
  DeviceNotRegistered: 'DEVICE_NOT_REGISTERED',
  MessageRateExceeded: 'MESSAGE_RATE_EXCEEDED',
  MessageTooBig: 'MESSAGE_TOO_BIG',
  MismatchSenderId: 'MISMATCH_SENDER_ID',
  InvalidCredentials: 'INVALID_CREDENTIALS',
};

export type ExpoSendResult =
  | { kind: 'accepted'; ticketId: string }
  | { kind: 'rejected'; code: string };

export type ExpoReceiptResult =
  | { kind: 'ok' }
  | { kind: 'error'; code: string };

export class ExpoPushOutcomeUnknownError extends Error {
  constructor() {
    super('PUSH_TEST_OUTCOME_UNKNOWN');
    this.name = 'ExpoPushOutcomeUnknownError';
  }
}

export class ExpoPushReceiptError extends Error {
  constructor() {
    super('PUSH_PROVIDER_UNAVAILABLE');
    this.name = 'ExpoPushReceiptError';
  }
}

function providerErrorCode(value: unknown): string {
  return typeof value === 'string'
    ? (ALLOWED_PROVIDER_ERRORS[value] ?? 'PROVIDER_REJECTED')
    : 'PROVIDER_REJECTED';
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('INVALID_PROVIDER_RESPONSE');
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('INVALID_PROVIDER_RESPONSE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class ExpoPushAdapter {
  private readonly logger = new Logger(ExpoPushAdapter.name);
  private readonly config: PushConfig;
  private readonly fetcher: typeof fetch;

  constructor() {
    this.config = createPushConfig();
    this.fetcher = (input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init);
  }

  async send(expoToken: string, attemptId: string): Promise<ExpoSendResult> {
    if (!this.config.enabled || !this.config.accessToken) {
      throw new ExpoPushOutcomeUnknownError();
    }

    const payload = {
      to: expoToken,
      title: 'Teste de notificações',
      body: 'Este é um teste de notificações do aplicativo.',
      data: { type: 'push-test', attemptId },
      sound: 'default',
      channelId: 'push-test',
      ttl: 60,
    };

    let response: Response;
    let body: unknown;
    try {
      ({ response, body } = await this.request(SEND_URL, payload));
    } catch {
      throw new ExpoPushOutcomeUnknownError();
    }

    if (response.status === 429) {
      return { kind: 'rejected', code: 'MESSAGE_RATE_EXCEEDED' };
    }
    if (response.status === 401 || response.status === 403) {
      return { kind: 'rejected', code: 'INVALID_CREDENTIALS' };
    }
    const data = isRecord(body) ? body.data : undefined;
    const ticket: unknown = Array.isArray(data)
      ? data.length === 1
        ? data[0]
        : undefined
      : data;
    if (!isRecord(ticket)) {
      this.logger.warn('operation=send event=INVALID_RESPONSE');
      if (response.status >= 400 && response.status < 500) {
        return { kind: 'rejected', code: 'PROVIDER_REJECTED' };
      }
      throw new ExpoPushOutcomeUnknownError();
    }
    if (ticket.status === 'ok') {
      if (typeof ticket.id !== 'string' || !ticketIdPattern.test(ticket.id)) {
        this.logger.warn('operation=send event=INVALID_RESPONSE');
        throw new ExpoPushOutcomeUnknownError();
      }
      return { kind: 'accepted', ticketId: ticket.id };
    }
    if (ticket.status === 'error') {
      const details = isRecord(ticket.details) ? ticket.details : undefined;
      return {
        kind: 'rejected',
        code: providerErrorCode(details?.error),
      };
    }
    this.logger.warn('operation=send event=INVALID_RESPONSE');
    throw new ExpoPushOutcomeUnknownError();
  }

  async getReceipts(
    ticketIds: string[],
    signal?: AbortSignal,
  ): Promise<Record<string, ExpoReceiptResult>> {
    if (!this.config.enabled || !this.config.accessToken) {
      throw new ExpoPushReceiptError();
    }
    const boundedIds = ticketIds
      .filter((id) => typeof id === 'string' && ticketIdPattern.test(id))
      .slice(0, 100);
    if (boundedIds.length === 0) return {};

    let response: Response;
    let body: unknown;
    try {
      ({ response, body } = await this.request(
        RECEIPTS_URL,
        { ids: boundedIds },
        signal,
      ));
    } catch {
      throw new ExpoPushReceiptError();
    }
    if (!response.ok || !isRecord(body) || !isRecord(body.data)) {
      throw new ExpoPushReceiptError();
    }

    const requested = new Set(boundedIds);
    const results: Record<string, ExpoReceiptResult> = {};
    for (const [ticketId, value] of Object.entries(body.data)) {
      if (!requested.has(ticketId) || !isRecord(value)) continue;
      if (value.status === 'ok') {
        results[ticketId] = { kind: 'ok' };
      } else if (value.status === 'error') {
        const details = isRecord(value.details) ? value.details : undefined;
        results[ticketId] = {
          kind: 'error',
          code: providerErrorCode(details?.error),
        };
      }
    }
    return results;
  }

  private async request(
    url: string,
    payload: unknown,
    externalSignal?: AbortSignal,
  ): Promise<{ response: Response; body: unknown }> {
    const controller = new AbortController();
    const operation = url === SEND_URL ? 'send' : 'receipts';
    let timedOut = false;
    const abort = () => controller.abort();
    if (externalSignal?.aborted) abort();
    else externalSignal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).catch(() => {
        const event = timedOut
          ? 'TIMEOUT'
          : controller.signal.aborted
            ? 'ABORTED'
            : 'TRANSPORT_ERROR';
        this.logger.warn(`operation=${operation} event=${event}`);
        throw new Error('PROVIDER_TRANSPORT_ERROR');
      });
      this.logger.log(
        `operation=${operation} event=HTTP_RESPONSE status=${response.status}`,
      );
      try {
        return { response, body: await readBoundedJson(response) };
      } catch {
        this.logger.warn(
          `operation=${operation} event=${timedOut ? 'TIMEOUT' : 'INVALID_RESPONSE'}`,
        );
        if (response.status >= 400 && response.status < 500) {
          return { response, body: null };
        }
        throw new Error('INVALID_PROVIDER_RESPONSE');
      }
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    }
  }
}
