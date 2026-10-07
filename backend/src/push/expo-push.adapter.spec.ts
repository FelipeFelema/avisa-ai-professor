import { Logger } from '@nestjs/common';
import {
  ExpoPushAdapter,
  ExpoPushOutcomeUnknownError,
} from './expo-push.adapter';

const accessToken = 'synthetic-expo-access-secret';
const expoToken = 'ExpoPushToken[synthetic-expo-destination-01]';
const attemptId = '00000000-0000-4000-8000-000000000321';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function requestBody(body: BodyInit | null | undefined): string {
  if (typeof body !== 'string')
    throw new Error('Expected a string request body.');
  return body;
}

describe('ExpoPushAdapter', () => {
  let adapter: ExpoPushAdapter;
  let previousEnabled: string | undefined;
  let previousAccessToken: string | undefined;
  let log: jest.SpyInstance<void, [unknown, ...unknown[]]>;
  let warn: jest.SpyInstance<void, [unknown, ...unknown[]]>;

  beforeEach(() => {
    jest.restoreAllMocks();
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    previousEnabled = process.env.EXPO_PUSH_ENABLED;
    previousAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = accessToken;
    adapter = new ExpoPushAdapter();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (previousEnabled === undefined) delete process.env.EXPO_PUSH_ENABLED;
    else process.env.EXPO_PUSH_ENABLED = previousEnabled;
    if (previousAccessToken === undefined)
      delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    else process.env.EXPO_PUSH_ACCESS_TOKEN = previousAccessToken;
  });

  it('sends one neutral destination to the fixed HTTPS endpoint with enhanced security', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ data: [{ status: 'ok', id: 'synthetic-ticket-1' }] }),
      );

    await expect(adapter.send(expoToken, attemptId)).resolves.toEqual({
      kind: 'accepted',
      ticketId: 'synthetic-ticket-1',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Bearer ${accessToken}`,
    );
    const body = requestBody(init?.body);
    const payload = JSON.parse(body) as Record<string, unknown>;
    expect(payload).toEqual({
      to: expoToken,
      title: 'Teste de notificações',
      body: 'Este é um teste de notificações do aplicativo.',
      data: { type: 'push-test', attemptId },
      sound: 'default',
      channelId: 'push-test',
      ttl: 60,
    });
    expect(Buffer.byteLength(body)).toBeLessThan(4096);
    expect(JSON.stringify(payload)).not.toMatch(
      /email|userId|classroom|deepLink/i,
    );
  });

  it('uses the same authenticated transport with only classroom name and announcement title', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [{ status: 'ok', id: 'synthetic-business-ticket' }],
      }),
    );
    const announcementId = '00000000-0000-4000-8000-000000000111';
    await expect(
      adapter.sendAnnouncement(expoToken, {
        announcementId,
        dispatchId: attemptId,
        ttl: 120,
        classroomName: 'Turma A',
        announcementTitle: 'Reunião de responsáveis',
      }),
    ).resolves.toEqual({
      kind: 'accepted',
      ticketId: 'synthetic-business-ticket',
    });
    const init = fetch.mock.calls[0][1];
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer ' + accessToken,
    );
    expect(JSON.parse(requestBody(init?.body))).toEqual({
      to: expoToken,
      title: 'Novo comunicado • Turma A',
      body: 'Reunião de responsáveis',
      data: {
        version: 1,
        type: 'announcement-created',
        announcementId,
        dispatchId: attemptId,
      },
      sound: 'default',
      channelId: 'push-test',
      ttl: 120,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends contextual reminder copy with no full content, recipients or expiry in data or logs', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ data: { status: 'ok', id: 'synthetic-reminder' } }),
      );
    await adapter.sendAnnouncement(expoToken, {
      announcementId: attemptId,
      dispatchId: attemptId,
      ttl: 120,
      type: 'announcement-expiring',
      classroomName: 'Turma A',
      announcementTitle: 'Reunião de responsáveis',
    });
    const payload = JSON.parse(requestBody(fetch.mock.calls[0][1]?.body)) as {
      data: unknown;
    };
    expect(payload).toEqual({
      to: expoToken,
      title: 'Comunicado próximo da expiração • Turma A',
      body: 'Reunião de responsáveis expira em breve.',
      data: {
        version: 1,
        type: 'announcement-expiring',
        announcementId: attemptId,
        dispatchId: attemptId,
      },
      sound: 'default',
      channelId: 'push-test',
      ttl: 120,
    });
    expect(Object.keys(payload.data as object).sort()).toEqual([
      'announcementId',
      'dispatchId',
      'type',
      'version',
    ]);
    expect(
      JSON.stringify([...log.mock.calls, ...warn.mock.calls]),
    ).not.toContain(expoToken);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, '', ' \n\t '])(
    'uses safe copy when contextual metadata is absent or blank (%s)',
    async (value) => {
      const fetch = jest
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(
            jsonResponse({ data: { status: 'ok', id: 'synthetic-fallback' } }),
          ),
        );
      for (const type of [
        'announcement-created',
        'announcement-expiring',
      ] as const) {
        await adapter.sendAnnouncement(expoToken, {
          announcementId: attemptId,
          dispatchId: attemptId,
          ttl: 60,
          type,
          classroomName: value,
          announcementTitle: value,
        });
        expect(
          JSON.parse(requestBody(fetch.mock.calls.at(-1)?.[1]?.body)),
        ).toMatchObject({
          title:
            type === 'announcement-created'
              ? 'Novo comunicado • Sua turma'
              : 'Comunicado próximo da expiração • Sua turma',
          body:
            type === 'announcement-created'
              ? 'Novo comunicado disponível'
              : 'Um comunicado expira em breve.',
        });
      }
    },
  );

  it('normalizes whitespace and bounds permitted metadata without logging it', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ data: { status: 'ok', id: 'synthetic-bounded' } }),
      );
    await adapter.sendAnnouncement(expoToken, {
      announcementId: attemptId,
      dispatchId: attemptId,
      ttl: 60,
      classroomName: '  Turma\n A  ',
      announcementTitle: 'Título '.repeat(1000),
    });
    const body = requestBody(fetch.mock.calls[0][1]?.body);
    const payload = JSON.parse(body) as { title: string; body: string };
    expect(payload.title).toBe('Novo comunicado • Turma A');
    expect(payload.body).toHaveLength(120);
    expect(Buffer.byteLength(body)).toBeLessThan(4096);
    expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls])).not.toMatch(
      /Turma|Título/,
    );
  });

  it('applies the same five-second timeout to reminders with no HTTP retry', async () => {
    jest.useFakeTimers();
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('synthetic')),
          );
        }),
    );
    const op = adapter.sendAnnouncement(expoToken, {
      announcementId: attemptId,
      dispatchId: attemptId,
      ttl: 120,
      type: 'announcement-expiring',
    });
    const assertion = expect(op).rejects.toBeInstanceOf(
      ExpoPushOutcomeUnknownError,
    );
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it.each([0, 3601])(
    'does not transmit a business notice with invalid TTL %i',
    async (ttl) => {
      const fetch = jest.spyOn(globalThis, 'fetch');
      await expect(
        adapter.sendAnnouncement(expoToken, {
          announcementId: attemptId,
          dispatchId: attemptId,
          ttl,
        }),
      ).rejects.toBeInstanceOf(ExpoPushOutcomeUnknownError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('bounds the send request to five seconds', async () => {
    jest.useFakeTimers();
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('synthetic raw transport cause'));
          });
        }),
    );

    const operation = adapter.send(expoToken, attemptId);
    const rejected = expect(operation).rejects.toBeInstanceOf(
      ExpoPushOutcomeUnknownError,
    );
    await jest.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('operation=send event=TIMEOUT');
    jest.useRealTimers();
  });

  it('accepts an individual successful ticket without retrying', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ data: { status: 'ok', id: 'synthetic-ticket-1' } }),
      );
    await expect(adapter.send(expoToken, attemptId)).resolves.toEqual({
      kind: 'accepted',
      ticketId: 'synthetic-ticket-1',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'operation=send event=HTTP_RESPONSE status=200',
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['DeviceNotRegistered', 'DEVICE_NOT_REGISTERED'],
    ['InvalidCredentials', 'INVALID_CREDENTIALS'],
    ['UNAUTHORIZED', 'PROVIDER_REJECTED'],
    ['synthetic private provider error', 'PROVIDER_REJECTED'],
  ])('sanitizes individual error ticket %s', async (error, code) => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          status: 'error',
          message: `${expoToken} ${accessToken} private provider response`,
          details: { error },
        },
      }),
    );
    await expect(adapter.send(expoToken, attemptId)).resolves.toEqual({
      kind: 'rejected',
      code,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    {},
    { data: [] },
    {
      data: [
        { status: 'ok', id: 'one' },
        { status: 'ok', id: 'two' },
      ],
    },
    { data: [null] },
    { data: { status: 'unexpected' } },
    { data: { status: 'ok' } },
    { data: { status: 'ok', id: 123 } },
    { data: { status: 'ok', id: 'x'.repeat(257) } },
    { data: { status: 'ok', id: 'invalid ticket with spaces' } },
  ])(
    'keeps invalid ticket response %# UNKNOWN without retrying',
    async (body) => {
      const fetch = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse(body));
      await expect(adapter.send(expoToken, attemptId)).rejects.toBeInstanceOf(
        ExpoPushOutcomeUnknownError,
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'operation=send event=INVALID_RESPONSE',
      );
    },
  );

  it('logs only safe HTTP, invalid response and transport diagnostics', async () => {
    const secretTicket = 'synthetic-private-provider-ticket';
    const raw = `${expoToken} ${accessToken} ${secretTicket} Authorization raw`;
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ data: { status: 'ok', id: secretTicket } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { status: 'error', message: raw } }),
      )
      .mockResolvedValueOnce(new Response(raw, { status: 200 }))
      .mockRejectedValueOnce(new Error(raw));

    await adapter.send(expoToken, attemptId);
    await expect(adapter.send(expoToken, attemptId)).resolves.toEqual({
      kind: 'rejected',
      code: 'PROVIDER_REJECTED',
    });
    for (let index = 0; index < 2; index++) {
      await expect(adapter.send(expoToken, attemptId)).rejects.toMatchObject({
        name: 'ExpoPushOutcomeUnknownError',
        message: 'PUSH_TEST_OUTCOME_UNKNOWN',
      });
    }
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledWith('operation=send event=TRANSPORT_ERROR');
    const logCalls = [...log.mock.calls, ...warn.mock.calls];
    for (const args of logCalls) {
      expect(args).toHaveLength(1);
      expect(args[0]).toMatch(
        /^operation=send event=(HTTP_RESPONSE status=200|INVALID_RESPONSE|TRANSPORT_ERROR)$/,
      );
      for (const privateValue of [expoToken, accessToken, secretTicket, raw]) {
        expect(JSON.stringify(args)).not.toContain(privateValue);
      }
    }
  });

  it.each([
    ['DeviceNotRegistered', 'DEVICE_NOT_REGISTERED'],
    ['MessageRateExceeded', 'MESSAGE_RATE_EXCEEDED'],
    ['MessageTooBig', 'MESSAGE_TOO_BIG'],
    ['MismatchSenderId', 'MISMATCH_SENDER_ID'],
    ['InvalidCredentials', 'INVALID_CREDENTIALS'],
  ])('normalizes known provider error %s', async (providerCode, code) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [
          {
            status: 'error',
            message: `${expoToken} ${accessToken}`,
            details: { error: providerCode },
          },
        ],
      }),
    );

    await expect(adapter.send(expoToken, attemptId)).resolves.toEqual({
      kind: 'rejected',
      code,
    });
  });

  it('maps HTTP 429 safely and keeps HTTP 5xx outcomes indeterminate', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('invalid body', { status: 429 }))
      .mockResolvedValueOnce(new Response('invalid body', { status: 503 }));

    await expect(adapter.send(expoToken, attemptId)).resolves.toEqual({
      kind: 'rejected',
      code: 'MESSAGE_RATE_EXCEEDED',
    });
    await expect(adapter.send(expoToken, attemptId)).rejects.toBeInstanceOf(
      ExpoPushOutcomeUnknownError,
    );
  });

  it('does not expose tokens, secrets, raw causes, or unbounded ticket ids', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error(`${expoToken} ${accessToken} raw cause`));
    await expect(adapter.send(expoToken, attemptId)).rejects.toMatchObject({
      name: 'ExpoPushOutcomeUnknownError',
      message: 'PUSH_TEST_OUTCOME_UNKNOWN',
    });

    jest.restoreAllMocks();
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({ data: [{ status: 'ok', id: 'x'.repeat(257) }] }),
      );
    await expect(adapter.send(expoToken, attemptId)).rejects.toBeInstanceOf(
      ExpoPushOutcomeUnknownError,
    );
  });

  it('uses the fixed receipt endpoint and returns only allowlisted outcomes', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          'synthetic-ticket-1': { status: 'ok' },
          'synthetic-ticket-2': {
            status: 'error',
            details: { error: 'DeviceNotRegistered' },
            message: `${expoToken} must never escape`,
          },
        },
      }),
    );

    await expect(
      adapter.getReceipts(['synthetic-ticket-1', 'synthetic-ticket-2']),
    ).resolves.toEqual({
      'synthetic-ticket-1': { kind: 'ok' },
      'synthetic-ticket-2': { kind: 'error', code: 'DEVICE_NOT_REGISTERED' },
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://exp.host/--/api/v2/push/getReceipts',
    );
    expect(
      new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization'),
    ).toBe(`Bearer ${accessToken}`);
    expect(requestBody(fetch.mock.calls[0]?.[1]?.body)).not.toContain(
      accessToken,
    );
  });

  it('rejects malformed or oversized provider responses as indeterminate', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{not-json', { status: 200 }));
    await expect(adapter.send(expoToken, attemptId)).rejects.toBeInstanceOf(
      ExpoPushOutcomeUnknownError,
    );

    jest.restoreAllMocks();
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(' '.repeat(20_000), { status: 200 }));
    await expect(adapter.send(expoToken, attemptId)).rejects.toBeInstanceOf(
      ExpoPushOutcomeUnknownError,
    );
  });
});
