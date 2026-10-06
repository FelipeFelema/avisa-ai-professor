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

  beforeEach(() => {
    jest.restoreAllMocks();
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
    jest.useRealTimers();
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
