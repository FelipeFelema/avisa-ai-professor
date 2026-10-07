import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';

type Actor = { userId: string; sessionId: string; token: string };
type Proof = { installationId: string; capability: string };
type Binding = { bindingId: string; lifecycleVersion: number };

const TEST_PATH = '/api/v1/push/installation/test';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

describe('push test concurrency and cooldown', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let oldEnabled: string | undefined;
  let oldAccessToken: string | undefined;

  async function startApp(): Promise<void> {
    app = (await createTestApp({
      configureBuilder: (builder) =>
        builder
          .overrideGuard(RateLimitGuard)
          .useValue({ canActivate: () => true }),
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
  }

  async function createActor(): Promise<Actor> {
    const user = await prisma.user.create({
      data: {
        name: 'Push test concurrency',
        email: `push-test-concurrency-${randomUUID()}@example.test`,
        password: 'synthetic-hash',
        role: Role.PARENT,
      },
    });
    const session = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        refreshTokenHash: 'synthetic-refresh-hash',
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    return {
      userId: user.id,
      sessionId: session.id,
      token: app.get(JwtService).sign(
        { sub: user.id, sid: session.id, email: user.email, role: user.role },
        {
          secret: app
            .get(ConfigService)
            .getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: '15m',
        },
      ),
    };
  }

  function proof(): Proof {
    return {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
  }

  function authenticated(
    method: 'post' | 'put' | 'delete',
    path: string,
    actor: Actor,
    identity: Proof,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .auth(actor.token, { type: 'bearer' })
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', identity.capability);
  }

  async function activate(actor: Actor, identity: Proof): Promise<Binding> {
    const reserved = await authenticated(
      'post',
      '/api/v1/push/installation/reserve',
      actor,
      identity,
    )
      .send({})
      .expect(200);
    const binding = reserved.body as Binding;
    await authenticated('put', '/api/v1/push/installation', actor, identity)
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        expectedTokenRevision: 0,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-concurrency-token-01]',
        permission: 'GRANTED',
      })
      .expect(200);
    return binding;
  }

  beforeAll(async () => {
    assertSafeTestDatabase();
    oldEnabled = process.env.EXPO_PUSH_ENABLED;
    oldAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = 'synthetic-backend-token';
    await startApp();
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

  it('allows at most one dispatch from two simultaneous HTTP connections', async () => {
    const actor = await createActor();
    const identity = proof();
    await activate(actor, identity);
    let beginProvider!: () => void;
    let finishProvider!: (response: Response) => void;
    const providerStarted = new Promise<void>((resolve) => {
      beginProvider = resolve;
    });
    const providerResult = new Promise<Response>((resolve) => {
      finishProvider = resolve;
    });
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => {
        beginProvider();
        return providerResult;
      });

    const firstPromise = authenticated('post', TEST_PATH, actor, identity)
      .send({})
      .then((response) => response);
    await providerStarted;
    const second = await authenticated('post', TEST_PATH, actor, identity)
      .send({})
      .expect(409);
    expect(second.headers['cache-control']).toBe('no-store');
    finishProvider(
      new Response(
        JSON.stringify({
          data: [{ status: 'ok', id: 'synthetic-concurrent-ticket' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const first = await firstPromise;

    expect(first.status).toBe(202);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await prisma.pushTestAttempt.count()).toBe(1);
  });

  it('returns the accepted ticket fact after logout races an in-flight neutral send', async () => {
    const actor = await createActor();
    const identity = proof();
    const binding = await activate(actor, identity);
    let beginProvider!: () => void;
    let finishProvider!: (response: Response) => void;
    const providerStarted = new Promise<void>((resolve) => {
      beginProvider = resolve;
    });
    const providerResult = new Promise<Response>((resolve) => {
      finishProvider = resolve;
    });
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        expect(requestUrl(input)).toBe('https://exp.host/--/api/v2/push/send');
        expect(typeof init?.body).toBe('string');
        if (typeof init?.body !== 'string') {
          throw new Error('The provider request body must be JSON text.');
        }
        const payload = JSON.parse(init.body) as Record<string, unknown>;
        expect(payload.title).toBe('Teste de notificações');
        expect(payload.body).toBe(
          'Este é um teste de notificações do aplicativo.',
        );
        expect(payload.data).toMatchObject({ type: 'push-test' });
        expect(JSON.stringify(payload)).not.toMatch(
          /email|userId|classroom|deepLink/i,
        );
        beginProvider();
        return providerResult;
      });

    const sending = authenticated('post', TEST_PATH, actor, identity)
      .send({})
      .then((response) => response);
    await providerStarted;
    await authenticated('delete', '/api/v1/push/installation', actor, identity)
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        reason: 'LOGOUT',
      })
      .expect(204);
    finishProvider(
      new Response(
        JSON.stringify({
          data: [{ status: 'ok', id: 'synthetic-race-ticket' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const accepted = await sending;
    expect(accepted.status).toBe(202);
    expect((accepted.body as { status: string }).status).toBe('ACCEPTED');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: binding.bindingId },
      }),
    ).toMatchObject({ state: 'REVOKED', expoToken: null });
  });

  it('keeps cooldown across application restart and never resends an indeterminate attempt', async () => {
    const actor = await createActor();
    const identity = proof();
    await activate(actor, identity);
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('synthetic raw provider timeout'));

    const uncertain = await authenticated('post', TEST_PATH, actor, identity)
      .send({})
      .expect(503);
    expect((uncertain.body as { message: string }).message).toBe(
      'PUSH_TEST_OUTCOME_UNKNOWN',
    );
    expect(JSON.stringify(uncertain.body)).not.toContain(
      'synthetic raw provider timeout',
    );
    expect(await prisma.pushTestAttempt.findFirst()).toMatchObject({
      state: 'UNKNOWN',
    });
    const availableAt = (
      await prisma.pushInstallation.findUniqueOrThrow({
        where: { id: identity.installationId },
      })
    ).nextTestAvailableAt;
    expect(availableAt).not.toBeNull();

    await app.close();
    await startApp();
    const limited = await authenticated('post', TEST_PATH, actor, identity)
      .send({})
      .expect(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await prisma.pushTestAttempt.count()).toBe(1);
  });

  it('revalidates session immediately before dispatch and sends nothing after revocation', async () => {
    const actor = await createActor();
    const identity = proof();
    await activate(actor, identity);
    const registrations = app.get(PushRegistrationService);
    const original: PushRegistrationService['withAuthenticatedProofLocks'] =
      registrations.withAuthenticatedProofLocks.bind(
        registrations,
      ) as PushRegistrationService['withAuthenticatedProofLocks'];
    let calls = 0;
    jest
      .spyOn(registrations, 'withAuthenticatedProofLocks')
      .mockImplementation(
        (
          requestActor: Parameters<
            PushRegistrationService['withAuthenticatedProofLocks']
          >[0],
          requestProof: Parameters<
            PushRegistrationService['withAuthenticatedProofLocks']
          >[1],
          operation: Parameters<
            PushRegistrationService['withAuthenticatedProofLocks']
          >[2],
        ) => {
          calls += 1;
          const revokeBeforeDispatch =
            calls === 2
              ? prisma.authSession.update({
                  where: { id: actor.sessionId },
                  data: { revokedAt: new Date() },
                })
              : Promise.resolve();
          return revokeBeforeDispatch.then(() =>
            original(requestActor, requestProof, operation),
          );
        },
      );
    const fetch = jest.spyOn(globalThis, 'fetch');

    const response = await authenticated('post', TEST_PATH, actor, identity)
      .send({})
      .expect(401);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(calls).toBe(2);
    expect(fetch).not.toHaveBeenCalled();
    expect(await prisma.pushTestAttempt.findFirst()).toMatchObject({
      state: 'REJECTED',
      failureCode: 'PUSH_BINDING_INACTIVE',
    });
  });
});
