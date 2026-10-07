import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';

type Actor = {
  userId: string;
  sessionId: string;
  token: string;
  email: string;
};
type Proof = { installationId: string; capability: string };
type PushBinding = {
  bindingId: string;
  lifecycleVersion: number;
};

const EXPO_ACCESS_SECRET = 'synthetic-privacy-expo-access-secret';
const EXPO_TOKEN = 'ExpoPushToken[synthetic-privacy-token-marker]';
const SQL_ERROR_SENTINEL = 'synthetic-privacy-sql-error-marker';

function bodyAs<T>(response: { body: unknown }): T {
  return response.body as T;
}

describe('Push privacy integration', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let oldEnabled: string | undefined;
  let oldAccessToken: string | undefined;

  async function createActor(): Promise<Actor> {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const email = `push-privacy-${randomUUID()}@example.test`;
    const user = await prisma.user.create({
      data: {
        id: userId,
        name: 'Push privacy synthetic account',
        email,
        password: 'synthetic-privacy-password-hash',
        role: Role.PARENT,
      },
    });
    const session = await prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: 'synthetic-privacy-refresh-hash',
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    const token = app.get(JwtService).sign(
      { sub: user.id, sid: session.id, email: user.email, role: Role.PARENT },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    return { userId: user.id, sessionId: session.id, token, email };
  }

  function call(
    method: 'post' | 'put',
    path: string,
    actor: Actor,
    proof: Proof,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .auth(actor.token, { type: 'bearer' })
      .set('X-Push-Installation', proof.installationId)
      .set('X-Push-Capability', proof.capability);
  }

  beforeAll(async () => {
    assertSafeTestDatabase();
    oldEnabled = process.env.EXPO_PUSH_ENABLED;
    oldAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = EXPO_ACCESS_SECRET;
    app = (await createTestApp({
      configureBuilder: (builder) =>
        builder
          .overrideGuard(RateLimitGuard)
          .useValue({ canActivate: () => true }),
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
    await clearTestDatabase(prisma);
  });

  beforeEach(async () => clearTestDatabase(prisma));

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await app.close();
    if (oldEnabled === undefined) delete process.env.EXPO_PUSH_ENABLED;
    else process.env.EXPO_PUSH_ENABLED = oldEnabled;
    if (oldAccessToken === undefined) delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    else process.env.EXPO_PUSH_ACCESS_TOKEN = oldAccessToken;
  });

  it('keeps private markers out of responses, provider URLs, notification content, and logs', async () => {
    const actor = await createActor();
    const proof: Proof = {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
    const privateMarkers = [
      proof.installationId,
      proof.capability,
      EXPO_TOKEN,
      EXPO_ACCESS_SECRET,
      actor.userId,
      actor.sessionId,
      actor.email,
    ];
    const logCalls: unknown[][] = [];
    const captureLog = (...args: unknown[]) => logCalls.push(args);
    jest.spyOn(console, 'log').mockImplementation(captureLog);
    jest.spyOn(console, 'warn').mockImplementation(captureLog);
    jest.spyOn(console, 'error').mockImplementation(captureLog);
    let providerUrl = '';
    let providerHeaders = new Headers();
    let providerPayload: Record<string, unknown> = {};
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        providerUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        providerHeaders = new Headers(init?.headers);
        if (typeof init?.body !== 'string') {
          return Promise.reject(new Error('Expected a JSON request body.'));
        }
        providerPayload = JSON.parse(init.body) as Record<string, unknown>;
        return Promise.reject(
          new Error(
            `${EXPO_TOKEN} ${EXPO_ACCESS_SECRET} ${proof.capability} ${proof.installationId}`,
          ),
        );
      });

    const reserved = await call(
      'post',
      '/api/v1/push/installation/reserve',
      actor,
      proof,
    )
      .send({})
      .expect(200);
    const binding = bodyAs<PushBinding>(reserved);
    const activated = await call(
      'put',
      '/api/v1/push/installation',
      actor,
      proof,
    )
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        expectedTokenRevision: 0,
        platform: 'ANDROID',
        expoToken: EXPO_TOKEN,
        permission: 'GRANTED',
      })
      .expect(200);
    const outcome = await call(
      'post',
      '/api/v1/push/installation/test',
      actor,
      proof,
    )
      .send({})
      .expect(503);

    const publicAndLogged = JSON.stringify([
      reserved.body,
      activated.body,
      outcome.body,
      logCalls,
    ]);
    for (const marker of privateMarkers) {
      expect(publicAndLogged).not.toContain(marker);
    }
    expect(providerUrl).toBe('https://exp.host/--/api/v2/push/send');
    expect(providerUrl).not.toMatch(/[?#]/);
    expect(providerHeaders.get('authorization')).toBe(
      `Bearer ${EXPO_ACCESS_SECRET}`,
    );
    expect(providerPayload.to).toBe(EXPO_TOKEN);

    // The Expo token and access token are required only in their private protocol
    // fields; neither belongs in notification text/data, URL, response, or logs.
    const notificationContent = JSON.stringify({
      ...providerPayload,
      to: '<private Expo recipient>',
    });
    for (const marker of [
      proof.installationId,
      proof.capability,
      EXPO_TOKEN,
      EXPO_ACCESS_SECRET,
      actor.userId,
      actor.sessionId,
      actor.email,
    ]) {
      expect(notificationContent).not.toContain(marker);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sanitizes SQL and validation failures instead of echoing supplied markers', async () => {
    const actor = await createActor();
    const proof: Proof = {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
    const logCalls: unknown[][] = [];
    const captureLog = (...args: unknown[]) => logCalls.push(args);
    jest.spyOn(console, 'log').mockImplementation(captureLog);
    jest.spyOn(console, 'warn').mockImplementation(captureLog);
    jest.spyOn(console, 'error').mockImplementation(captureLog);
    const transaction = jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(
        new Error(
          `${SQL_ERROR_SENTINEL} ${proof.installationId} ${proof.capability}`,
        ),
      );

    const sqlFailure = await call(
      'post',
      '/api/v1/push/installation/reserve',
      actor,
      proof,
    )
      .send({})
      .expect(500);
    transaction.mockRestore();

    const validationFailure = await call(
      'post',
      '/api/v1/push/installation/reserve',
      actor,
      proof,
    )
      .send({ destination: EXPO_TOKEN, privateMarker: SQL_ERROR_SENTINEL })
      .expect(400);

    const publicErrors = JSON.stringify([
      sqlFailure.body,
      validationFailure.body,
      logCalls,
    ]);
    for (const marker of [
      SQL_ERROR_SENTINEL,
      proof.installationId,
      proof.capability,
      EXPO_TOKEN,
    ]) {
      expect(publicErrors).not.toContain(marker);
    }
  });
});
