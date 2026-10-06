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

type Actor = { userId: string; sessionId: string; token: string };
type Proof = { installationId: string; capability: string };
type PushBinding = {
  bindingId: string;
  lifecycleVersion: number;
  tokenRevision: number;
  state: 'RESERVED' | 'ACTIVE';
};

function bodyAs<T>(response: { body: unknown }): T {
  return response.body as T;
}

function bindingRequest(binding: PushBinding) {
  return {
    bindingId: binding.bindingId,
    lifecycleVersion: binding.lifecycleVersion,
  };
}

describe('Push installation HTTP contracts', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let oldEnabled: string | undefined;
  let oldAccessToken: string | undefined;
  let oldCorsOrigin: string | undefined;

  async function createActor(role: Role): Promise<Actor> {
    const user = await prisma.user.create({
      data: {
        name: `Push e2e ${role}`,
        email: `push-e2e-${randomUUID()}@example.test`,
        password: 'synthetic-hash',
        role,
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
        { sub: user.id, sid: session.id, email: user.email, role },
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

  function call(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    actor: Actor | null,
    identity: Proof,
  ) {
    const operation = request(app.getHttpServer())
      [method](path)
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', identity.capability);
    return actor ? operation.auth(actor.token, { type: 'bearer' }) : operation;
  }

  async function reserve(actor: Actor, identity: Proof) {
    return call('post', '/api/v1/push/installation/reserve', actor, identity)
      .send({})
      .expect(200);
  }

  beforeAll(async () => {
    assertSafeTestDatabase();
    oldEnabled = process.env.EXPO_PUSH_ENABLED;
    oldAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    oldCorsOrigin = process.env.CORS_ORIGIN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = 'synthetic-backend-only-token';
    process.env.CORS_ORIGIN = 'https://app.example.test, http://localhost:3000';
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
    if (oldCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = oldCorsOrigin;
  });

  it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
    'serves reserve/state/activate to %s with no provider request',
    async (role) => {
      const actor = await createActor(role);
      const identity = proof();
      const reserved = await reserve(actor, identity);
      const binding = bodyAs<PushBinding>(reserved);
      expect(reserved.headers['cache-control']).toBe('no-store');

      const state = await call(
        'get',
        '/api/v1/push/installation',
        actor,
        identity,
      ).expect(200);
      expect(state.headers['cache-control']).toBe('no-store');
      expect(bodyAs<{ state: string }>(state).state).toBe('RESERVED');

      const activated = await call(
        'put',
        '/api/v1/push/installation',
        actor,
        identity,
      )
        .send({
          ...bindingRequest(binding),
          expectedTokenRevision: 0,
          platform: 'IOS',
          expoToken: 'ExpoPushToken[synthetic-e2e-token-001]',
          permission: 'GRANTED',
        })
        .expect(200);
      expect(activated.headers['cache-control']).toBe('no-store');
      expect(bodyAs<PushBinding>(activated).state).toBe('ACTIVE');
      expect(await prisma.pushTestAttempt.count()).toBe(0);
    },
  );

  it('rotates only with the current CAS revision and requires a new binding after revocation', async () => {
    const actor = await createActor(Role.PARENT);
    const identity = proof();
    const reserved = bodyAs<PushBinding>(await reserve(actor, identity));
    const firstToken = 'ExpoPushToken[synthetic-e2e-rotate-first-11]';
    const nextToken = 'ExpoPushToken[synthetic-e2e-rotate-next-12]';
    const activate = (expectedTokenRevision: number, expoToken: string) =>
      call('put', '/api/v1/push/installation', actor, identity).send({
        ...bindingRequest(reserved),
        expectedTokenRevision,
        platform: 'ANDROID',
        expoToken,
        permission: 'GRANTED',
      });

    await activate(0, firstToken).expect(200);
    const rotated = await activate(1, nextToken).expect(200);
    expect(bodyAs<PushBinding>(rotated).tokenRevision).toBe(2);
    await activate(1, nextToken).expect(200);
    await activate(0, 'ExpoPushToken[synthetic-e2e-stale-13]').expect(409);

    await call('delete', '/api/v1/push/installation', null, identity)
      .send({ ...bindingRequest(reserved), reason: 'USER_DISABLED' })
      .expect(204);
    await activate(2, nextToken).expect(409);

    const nextBinding = bodyAs<PushBinding>(await reserve(actor, identity));
    expect(nextBinding.lifecycleVersion).toBe(reserved.lifecycleVersion + 1);
    expect(nextBinding.bindingId).not.toBe(reserved.bindingId);
    await call('put', '/api/v1/push/installation', actor, identity)
      .send({
        ...bindingRequest(nextBinding),
        expectedTokenRevision: 0,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-e2e-next-binding-14]',
        permission: 'GRANTED',
      })
      .expect(200);

    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: reserved.bindingId },
      }),
    ).toMatchObject({ state: 'REVOKED', expoToken: null, tokenRevision: 2 });
    expect(await prisma.pushTestAttempt.count()).toBe(0);
  });

  it('rejects missing/invalid JWT and invalid or malformed capability proofs safely', async () => {
    const actor = await createActor(Role.PARENT);
    const identity = proof();
    const missingJwt = await call(
      'post',
      '/api/v1/push/installation/reserve',
      null,
      identity,
    )
      .send({})
      .expect(401);
    expect(missingJwt.headers['cache-control']).toBe('no-store');

    const invalidJwt = await request(app.getHttpServer())
      .post('/api/v1/push/installation/reserve')
      .auth('not-a-jwt', { type: 'bearer' })
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', identity.capability)
      .send({})
      .expect(401);
    expect(invalidJwt.headers['cache-control']).toBe('no-store');

    const reserved = await reserve(actor, identity);
    await call('get', '/api/v1/push/installation', actor, {
      ...identity,
      capability: randomBytes(32).toString('base64url'),
    })
      .expect(403)
      .then((response) => {
        expect(response.headers['cache-control']).toBe('no-store');
        const body = bodyAs<{ message: string }>(response);
        expect(body.message).toBe('PUSH_INSTALLATION_PROOF_INVALID');
        expect(JSON.stringify(body)).not.toContain(identity.capability);
      });

    const malformed = await request(app.getHttpServer())
      .get('/api/v1/push/installation')
      .auth(actor.token, { type: 'bearer' })
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', 'A'.repeat(4096))
      .expect(400);
    expect(malformed.headers['cache-control']).toBe('no-store');
    expect(bodyAs<PushBinding>(reserved).state).toBe('RESERVED');
  });

  it('rejects extra body fields, recipient queries, invalid token bounds and integer overflow', async () => {
    const actor = await createActor(Role.PARENT);
    const identity = proof();
    await call(
      'post',
      '/api/v1/push/installation/reserve?userId=somebody-else',
      actor,
      identity,
    )
      .send({})
      .expect(400);
    await call('post', '/api/v1/push/installation/reserve', actor, identity)
      .send({ userId: 'somebody-else' })
      .expect(400);

    const reserved = await reserve(actor, identity);
    const binding = bodyAs<PushBinding>(reserved);
    const base = {
      ...bindingRequest(binding),
      expectedTokenRevision: 0,
      platform: 'ANDROID',
      expoToken: 'ExpoPushToken[synthetic-e2e-token-002]',
      permission: 'GRANTED',
    };
    for (const invalid of [
      { ...base, lifecycleVersion: 2147483648 },
      { ...base, expoToken: 'FCM:raw-provider-token' },
      { ...base, expoToken: 'ExpoPushToken[short]' },
      { ...base, unexpected: 'field' },
      { ...base, userId: 'somebody-else' },
      { ...base, sid: 'some-session' },
    ]) {
      const response = await call(
        'put',
        '/api/v1/push/installation',
        actor,
        identity,
      )
        .send(invalid)
        .expect(400);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(JSON.stringify(bodyAs<unknown>(response))).not.toContain(
        identity.capability,
      );
    }
    expect(await prisma.pushTestAttempt.count()).toBe(0);
    expect(
      await prisma.pushRegistration.count({ where: { state: 'ACTIVE' } }),
    ).toBe(0);
  });

  it('rejects a JWT whose session is revoked before the request without changing the registration', async () => {
    const actor = await createActor(Role.PARENT);
    const identity = proof();
    const reserved = await reserve(actor, identity);
    await prisma.authSession.update({
      where: { id: actor.sessionId },
      data: { revokedAt: new Date() },
    });
    const before = await prisma.pushRegistration.findMany({
      where: { installationId: identity.installationId },
    });
    const response = await call(
      'put',
      '/api/v1/push/installation',
      actor,
      identity,
    )
      .send({
        ...bindingRequest(bodyAs<PushBinding>(reserved)),
        expectedTokenRevision: 0,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-e2e-token-003]',
        permission: 'GRANTED',
      })
      .expect(401);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(
      await prisma.pushRegistration.findMany({
        where: { installationId: identity.installationId },
      }),
    ).toEqual(before);
    expect(await prisma.pushTestAttempt.count()).toBe(0);
  });

  it('revalidates the session inside the transaction when revocation follows the capability guard', async () => {
    const actor = await createActor(Role.PARENT);
    const identity = proof();
    await reserve(actor, identity);
    const before = await prisma.pushRegistration.findMany({
      where: { installationId: identity.installationId },
    });
    const installationDelegate = prisma.pushInstallation as unknown as {
      findUnique(args: { where: { id: string } }): Promise<unknown>;
    };
    const originalFind = installationDelegate.findUnique.bind(
      installationDelegate,
    ) as unknown as (args: { where: { id: string } }) => Promise<unknown>;
    jest
      .spyOn(installationDelegate, 'findUnique')
      .mockImplementation(async (args) => {
        const result = await originalFind(args);
        await prisma.authSession.update({
          where: { id: actor.sessionId },
          data: { revokedAt: new Date() },
        });
        return result;
      });

    const response = await call(
      'get',
      '/api/v1/push/installation',
      actor,
      identity,
    ).expect(401);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(
      await prisma.pushRegistration.findMany({
        where: { installationId: identity.installationId },
      }),
    ).toEqual(before);
    expect(await prisma.pushTestAttempt.count()).toBe(0);
  });

  it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
    'sends one neutral test for the current installation for %s',
    async (role) => {
      const actor = await createActor(role);
      const identity = proof();
      const reserved = bodyAs<PushBinding>(await reserve(actor, identity));
      await call('put', '/api/v1/push/installation', actor, identity)
        .send({
          ...bindingRequest(reserved),
          expectedTokenRevision: 0,
          platform: 'ANDROID',
          expoToken: `ExpoPushToken[synthetic-test-e2e-${role.toLowerCase()}]`,
          permission: 'GRANTED',
        })
        .expect(200);
      const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ status: 'ok', id: `synthetic-ticket-${role}` }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const response = await call(
        'post',
        '/api/v1/push/installation/test',
        actor,
        identity,
      )
        .send({})
        .expect(202);
      expect(response.headers['cache-control']).toBe('no-store');
      const accepted = response.body as {
        status: string;
        attemptId: string;
        acceptedAt: string;
        nextTestAvailableAt: string;
      };
      expect(accepted.status).toBe('ACCEPTED');
      expect(accepted.attemptId).toEqual(expect.any(String));
      expect(accepted.acceptedAt).toEqual(expect.any(String));
      expect(accepted.nextTestAvailableAt).toEqual(expect.any(String));
      expect(JSON.stringify(response.body)).not.toContain('synthetic-ticket');
      expect(JSON.stringify(response.body)).not.toContain('ExpoPushToken');
      expect(fetch).toHaveBeenCalledTimes(1);

      const limited = await call(
        'post',
        '/api/v1/push/installation/test',
        actor,
        identity,
      )
        .send({})
        .expect(429);
      expect(limited.headers['cache-control']).toBe('no-store');
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects test destinations, inactive bindings, and invalid proof before any provider request', async () => {
    const actor = await createActor(Role.PARENT);
    const identity = proof();
    await reserve(actor, identity);
    const fetch = jest.spyOn(globalThis, 'fetch');

    await call('post', '/api/v1/push/installation/test', actor, identity)
      .send({ destination: 'ExpoPushToken[synthetic-other-device]' })
      .expect(400);
    await call(
      'post',
      '/api/v1/push/installation/test?destination=other',
      actor,
      identity,
    )
      .send({})
      .expect(400);
    await call('post', '/api/v1/push/installation/test', actor, {
      ...identity,
      capability: randomBytes(32).toString('base64url'),
    })
      .send({})
      .expect(403);
    await call('post', '/api/v1/push/installation/test', actor, identity)
      .send({})
      .expect(409);
    expect(fetch).not.toHaveBeenCalled();
    expect(await prisma.pushTestAttempt.count()).toBe(0);
  });

  it('requires JSON bodies strictly within the route contract and returns no-store on errors', async () => {
    const actor = await createActor(Role.PARENT);
    const identity = proof();
    const oversized = await call(
      'post',
      '/api/v1/push/installation/reserve',
      actor,
      identity,
    )
      .set('Content-Type', 'application/json')
      .send({ payload: 'x'.repeat(4096) });
    expect(oversized.status).toBe(413);
    expect(oversized.body).toMatchObject({
      statusCode: 413,
      message: 'PUSH_INVALID_REQUEST',
    });
    expect(JSON.stringify(oversized.body)).not.toContain(
      'PayloadTooLargeError',
    );
    expect(oversized.headers['cache-control']).toBe('no-store');
  });

  it('allows the push PUT preflight headers without changing other CORS methods', async () => {
    const previousOrigins = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'https://app.example.test, http://localhost:3000';
    try {
      const preflight = await request(app.getHttpServer())
        .options('/api/v1/push/installation')
        .set('Origin', 'https://app.example.test')
        .set('Access-Control-Request-Method', 'PUT')
        .set(
          'Access-Control-Request-Headers',
          'authorization,content-type,x-push-installation,x-push-capability',
        )
        .expect(204);
      expect(preflight.headers['cache-control']).toBe('no-store');
      expect(preflight.headers['access-control-allow-origin']).toBe(
        'https://app.example.test',
      );
      expect(preflight.headers['access-control-allow-methods']).toContain(
        'PUT',
      );
      expect(preflight.headers['access-control-allow-headers']).toContain(
        'X-Push-Installation',
      );
      expect(preflight.headers['access-control-allow-headers']).toContain(
        'X-Push-Capability',
      );

      const deniedOrigin = await request(app.getHttpServer())
        .options('/api/v1/push/installation')
        .set('Origin', 'https://untrusted.example.test')
        .set('Access-Control-Request-Method', 'PUT')
        .expect(204);
      expect(
        deniedOrigin.headers['access-control-allow-origin'],
      ).toBeUndefined();

      const regularPatch = await request(app.getHttpServer())
        .options('/api/v1/users/profile')
        .set('Origin', 'https://app.example.test')
        .set('Access-Control-Request-Method', 'PATCH')
        .expect(204);
      expect(regularPatch.headers['access-control-allow-origin']).toBe(
        'https://app.example.test',
      );
      expect(
        regularPatch.headers['access-control-allow-methods'],
      ).not.toContain('PUT');
    } finally {
      if (previousOrigins === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = previousOrigins;
    }
  });
});
