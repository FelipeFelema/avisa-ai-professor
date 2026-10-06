import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';

type PushActor = { id: string; sid: string; accessToken: string };
type PushBinding = {
  bindingId: string;
  lifecycleVersion: number;
  tokenRevision: number;
  state: 'RESERVED' | 'ACTIVE';
};
type PushState = {
  available: boolean;
  state: 'ABSENT' | 'RESERVED' | 'ACTIVE' | 'INACTIVE';
  binding: PushBinding | null;
  reason: string | null;
  testAvailableAt: string | null;
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

describe('Push registration integration', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let previousEnabled: string | undefined;
  let previousAccessToken: string | undefined;

  async function createActor(role: Role = Role.PARENT): Promise<PushActor> {
    const user = await prisma.user.create({
      data: {
        name: `Push ${role}`,
        email: `push-${randomUUID()}@example.test`,
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
    const accessToken = app.get(JwtService).sign(
      { sub: user.id, sid: session.id, email: user.email, role },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    return { id: user.id, sid: session.id, accessToken };
  }

  async function createSiblingSession(actor: PushActor): Promise<PushActor> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { email: true, role: true },
    });
    const session = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        userId: actor.id,
        refreshTokenHash: 'synthetic-refresh-hash',
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    const accessToken = app.get(JwtService).sign(
      { sub: actor.id, sid: session.id, email: user.email, role: user.role },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    return { id: actor.id, sid: session.id, accessToken };
  }

  async function signRefreshedActor(actor: PushActor): Promise<PushActor> {
    const [user, session] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { email: true, role: true },
      }),
      prisma.authSession.findUniqueOrThrow({ where: { id: actor.sid } }),
    ]);
    return {
      ...actor,
      accessToken: app.get(JwtService).sign(
        { sub: actor.id, sid: session.id, email: user.email, role: user.role },
        {
          secret: app
            .get(ConfigService)
            .getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: '15m',
        },
      ),
    };
  }

  function proof() {
    return {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
  }

  function pushRequest(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
  ) {
    return request(app.getHttpServer())[method](path);
  }

  function authenticated(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    actor: PushActor,
    identity: ReturnType<typeof proof>,
  ) {
    return pushRequest(method, path)
      .auth(actor.accessToken, { type: 'bearer' })
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', identity.capability);
  }

  async function reserve(actor: PushActor, identity: ReturnType<typeof proof>) {
    return authenticated(
      'post',
      '/api/v1/push/installation/reserve',
      actor,
      identity,
    )
      .send({})
      .expect(200);
  }

  async function activate(
    actor: PushActor,
    identity: ReturnType<typeof proof>,
    binding: { bindingId: string; lifecycleVersion: number },
    expoToken = 'ExpoPushToken[synthetic-token-0101]',
    expectedTokenRevision = 0,
  ) {
    return authenticated('put', '/api/v1/push/installation', actor, identity)
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        expectedTokenRevision,
        platform: 'ANDROID',
        expoToken,
        permission: 'GRANTED',
      })
      .expect(200);
  }

  beforeAll(async () => {
    assertSafeTestDatabase();
    previousEnabled = process.env.EXPO_PUSH_ENABLED;
    previousAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = 'synthetic-backend-only-token';
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

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await app.close();
    if (previousEnabled === undefined) delete process.env.EXPO_PUSH_ENABLED;
    else process.env.EXPO_PUSH_ENABLED = previousEnabled;
    if (previousAccessToken === undefined)
      delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    else process.env.EXPO_PUSH_ACCESS_TOKEN = previousAccessToken;
  });

  it('reserves idempotently, reports scoped state, and activates exactly once', async () => {
    const actor = await createActor();
    const identity = proof();

    const reserved = await reserve(actor, identity);
    const binding = bodyAs<PushBinding>(reserved);
    expect(reserved.headers['cache-control']).toBe('no-store');
    expect(binding).toMatchObject({
      lifecycleVersion: 1,
      tokenRevision: 0,
      state: 'RESERVED',
    });
    expect(binding).toHaveProperty('bindingId');
    expect(JSON.stringify(binding)).not.toContain(identity.capability);

    expect(bodyAs<PushBinding>(await reserve(actor, identity))).toMatchObject(
      binding,
    );

    const state = await authenticated(
      'get',
      '/api/v1/push/installation',
      actor,
      identity,
    ).expect(200);
    expect(bodyAs<PushState>(state)).toEqual({
      available: true,
      state: 'RESERVED',
      binding,
      reason: null,
      testAvailableAt: null,
    });

    const activation = await activate(actor, identity, binding);
    expect(bodyAs<PushBinding>(activation)).toMatchObject({
      bindingId: binding.bindingId,
      lifecycleVersion: 1,
      tokenRevision: 1,
      state: 'ACTIVE',
    });
    await activate(actor, identity, binding);
    expect(await prisma.pushRegistration.count()).toBe(1);
    expect(
      await prisma.pushRegistration.count({ where: { state: 'ACTIVE' } }),
    ).toBe(1);
    expect((await prisma.pushRegistration.findFirstOrThrow()).expoToken).toBe(
      'ExpoPushToken[synthetic-token-0101]',
    );
  });

  it.each(Object.values(Role))(
    'supports explicit reserve/activate for %s without provider sends',
    async (role) => {
      const actor = await createActor(role);
      const identity = proof();
      const reserved = await reserve(actor, identity);
      await activate(actor, identity, bodyAs<PushBinding>(reserved));
      expect(
        await prisma.pushRegistration.count({ where: { userId: actor.id } }),
      ).toBe(1);
    },
  );

  it('keeps another account from seeing or changing a protected active binding', async () => {
    const owner = await createActor(Role.PARENT);
    const other = await createActor(Role.PROFESSOR);
    const identity = proof();
    const reserved = await reserve(owner, identity);
    const binding = bodyAs<PushBinding>(reserved);
    await activate(owner, identity, binding);
    const before = await prisma.pushRegistration.findMany({
      where: { installationId: identity.installationId },
      orderBy: { lifecycleVersion: 'asc' },
    });

    const state = await authenticated(
      'get',
      '/api/v1/push/installation',
      other,
      identity,
    ).expect(200);
    const otherState = bodyAs<PushState>(state);
    expect(otherState.state).toBe('INACTIVE');
    expect(otherState.binding).toBeNull();
    await authenticated(
      'post',
      '/api/v1/push/installation/reserve',
      other,
      identity,
    )
      .send({})
      .expect(409);
    await authenticated('put', '/api/v1/push/installation', other, identity)
      .send({
        ...bindingRequest(binding),
        expectedTokenRevision: 1,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-token-0202]',
        permission: 'GRANTED',
      })
      .expect(409);

    const after = await prisma.pushRegistration.findMany({
      where: { installationId: identity.installationId },
      orderBy: { lifecycleVersion: 'asc' },
    });
    expect(after).toEqual(before);
    expect(await prisma.pushTestAttempt.count()).toBe(0);
  });

  it('rejects a reused token on another protected installation without changing either victim', async () => {
    const first = await createActor();
    const second = await createActor(Role.PROFESSOR);
    const firstIdentity = proof();
    const secondIdentity = proof();
    const firstBinding = bodyAs<PushBinding>(
      await reserve(first, firstIdentity),
    );
    const secondBinding = bodyAs<PushBinding>(
      await reserve(second, secondIdentity),
    );
    const sharedToken = 'ExpoPushToken[synthetic-shared-3030]';
    await activate(first, firstIdentity, firstBinding, sharedToken);
    const firstBefore = await prisma.pushRegistration.findFirstOrThrow({
      where: { installationId: firstIdentity.installationId },
    });

    await authenticated(
      'put',
      '/api/v1/push/installation',
      second,
      secondIdentity,
    )
      .send({
        ...bindingRequest(secondBinding),
        expectedTokenRevision: 0,
        platform: 'IOS',
        expoToken: sharedToken,
        permission: 'GRANTED',
      })
      .expect(409);
    expect(
      await prisma.pushRegistration.findFirstOrThrow({
        where: { installationId: firstIdentity.installationId },
      }),
    ).toEqual(firstBefore);
    expect(
      await prisma.pushRegistration.findFirstOrThrow({
        where: { installationId: secondIdentity.installationId },
      }),
    ).toMatchObject({ state: 'RESERVED', expoToken: null, tokenRevision: 0 });
    expect(await prisma.pushTestAttempt.count()).toBe(0);
  });

  it('rejects the same eligible token across two installations owned by one account', async () => {
    const actor = await createActor();
    const sibling = await createSiblingSession(actor);
    const firstIdentity = proof();
    const secondIdentity = proof();
    const firstBinding = bodyAs<PushBinding>(
      await reserve(actor, firstIdentity),
    );
    const secondBinding = bodyAs<PushBinding>(
      await reserve(sibling, secondIdentity),
    );
    const sharedToken = 'ExpoPushToken[synthetic-same-account-shared-01]';
    await activate(actor, firstIdentity, firstBinding, sharedToken);
    const firstBefore = await prisma.pushRegistration.findUniqueOrThrow({
      where: { id: firstBinding.bindingId },
    });

    await authenticated(
      'put',
      '/api/v1/push/installation',
      sibling,
      secondIdentity,
    )
      .send({
        ...bindingRequest(secondBinding),
        expectedTokenRevision: 0,
        platform: 'IOS',
        expoToken: sharedToken,
        permission: 'GRANTED',
      })
      .expect(409);

    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: firstBinding.bindingId },
      }),
    ).toEqual(firstBefore);
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: secondBinding.bindingId },
      }),
    ).toMatchObject({ state: 'RESERVED', expoToken: null, tokenRevision: 0 });
  });

  it('reports backend configuration loss and refuses further activation without changing the reserved binding', async () => {
    const actor = await createActor();
    const identity = proof();
    const reserved = await reserve(actor, identity);
    const binding = bodyAs<PushBinding>(reserved);
    const existingEnabled = process.env.EXPO_PUSH_ENABLED;
    const existingAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'false';
    delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    try {
      const state = await authenticated(
        'get',
        '/api/v1/push/installation',
        actor,
        identity,
      ).expect(200);
      expect(bodyAs<PushState>(state)).toMatchObject({
        available: false,
        state: 'INACTIVE',
        binding: null,
        reason: 'CONFIGURATION_UNAVAILABLE',
      });
      const unavailable = await authenticated(
        'put',
        '/api/v1/push/installation',
        actor,
        identity,
      )
        .send({
          ...bindingRequest(binding),
          expectedTokenRevision: 0,
          platform: 'ANDROID',
          expoToken: 'ExpoPushToken[synthetic-token-0102]',
          permission: 'GRANTED',
        })
        .expect(503);
      expect(bodyAs<{ message: string }>(unavailable).message).toBe(
        'PUSH_UNAVAILABLE',
      );
      expect(
        await prisma.pushRegistration.findFirstOrThrow({
          where: { installationId: identity.installationId },
        }),
      ).toMatchObject({ state: 'RESERVED', expoToken: null, tokenRevision: 0 });
      expect(await prisma.pushTestAttempt.count()).toBe(0);
    } finally {
      if (existingEnabled === undefined) delete process.env.EXPO_PUSH_ENABLED;
      else process.env.EXPO_PUSH_ENABLED = existingEnabled;
      if (existingAccessToken === undefined)
        delete process.env.EXPO_PUSH_ACCESS_TOKEN;
      else process.env.EXPO_PUSH_ACCESS_TOKEN = existingAccessToken;
    }
  });

  it('revokes through capability-only DELETE and creates a fresh lifecycle on a later reserve', async () => {
    const actor = await createActor();
    const identity = proof();
    const reserved = await reserve(actor, identity);
    const binding = bodyAs<PushBinding>(reserved);
    await activate(actor, identity, binding);
    await request(app.getHttpServer())
      .delete('/api/v1/push/installation')
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', identity.capability)
      .send({ ...bindingRequest(binding), reason: 'USER_DISABLED' })
      .expect(204);
    expect(
      await prisma.pushRegistration.findFirstOrThrow({
        where: { id: binding.bindingId },
      }),
    ).toMatchObject({
      state: 'REVOKED',
      expoToken: null,
      reason: 'USER_DISABLED',
    });

    const next = await reserve(actor, identity);
    const nextBinding = bodyAs<PushBinding>(next);
    expect(nextBinding.lifecycleVersion).toBe(2);
    expect(nextBinding.bindingId).not.toBe(binding.bindingId);
    await authenticated('put', '/api/v1/push/installation', actor, identity)
      .send({
        ...bindingRequest(binding),
        expectedTokenRevision: 1,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-token-old-binding]',
        permission: 'GRANTED',
      })
      .expect(409);
  });

  it('rotates with exact CAS, accepts a lost-response retry, and keeps stale revisions inert', async () => {
    const actor = await createActor();
    const identity = proof();
    const binding = bodyAs<PushBinding>(await reserve(actor, identity));
    const firstToken = 'ExpoPushToken[synthetic-rotation-first-01]';
    const nextToken = 'ExpoPushToken[synthetic-rotation-next-02]';
    await activate(actor, identity, binding, firstToken, 0);

    const rotated = await activate(actor, identity, binding, nextToken, 1);
    expect(bodyAs<PushBinding>(rotated)).toMatchObject({
      tokenRevision: 2,
      state: 'ACTIVE',
    });
    await activate(actor, identity, binding, nextToken, 1);
    const platformChanged = await authenticated(
      'put',
      '/api/v1/push/installation',
      actor,
      identity,
    )
      .send({
        ...bindingRequest(binding),
        expectedTokenRevision: 2,
        platform: 'IOS',
        expoToken: nextToken,
        permission: 'GRANTED',
      })
      .expect(200);
    expect(bodyAs<PushBinding>(platformChanged)).toMatchObject({
      tokenRevision: 3,
      state: 'ACTIVE',
    });
    await authenticated('put', '/api/v1/push/installation', actor, identity)
      .send({
        ...bindingRequest(binding),
        expectedTokenRevision: 0,
        platform: 'IOS',
        expoToken: 'ExpoPushToken[synthetic-stale-token-03]',
        permission: 'GRANTED',
      })
      .expect(409);

    const registration = await prisma.pushRegistration.findUniqueOrThrow({
      where: { id: binding.bindingId },
    });
    expect(registration).toMatchObject({
      state: 'ACTIVE',
      expoToken: nextToken,
      tokenRevision: 3,
      platform: 'IOS',
    });
    expect(registration.tokenFingerprint).toBe(
      createHash('sha256').update(nextToken).digest('hex'),
    );
    expect(
      await prisma.pushRegistration.count({ where: { expoToken: firstToken } }),
    ).toBe(0);
  });

  it('keeps the current session eligible after an email change and releases sibling tokens', async () => {
    const actor = await createActor();
    const sibling = await createSiblingSession(actor);
    const currentIdentity = proof();
    const siblingIdentity = proof();
    const currentBinding = bodyAs<PushBinding>(
      await reserve(actor, currentIdentity),
    );
    const siblingBinding = bodyAs<PushBinding>(
      await reserve(sibling, siblingIdentity),
    );
    const currentToken = 'ExpoPushToken[synthetic-email-current-01]';
    const siblingToken = 'ExpoPushToken[synthetic-email-sibling-02]';
    await activate(actor, currentIdentity, currentBinding, currentToken);
    await activate(sibling, siblingIdentity, siblingBinding, siblingToken);

    const updatedEmail = `push-email-${randomUUID()}@example.test`;
    const profile = await request(app.getHttpServer())
      .patch('/api/v1/users/profile')
      .auth(actor.accessToken, { type: 'bearer' })
      .send({ email: updatedEmail })
      .expect(200);
    expect(bodyAs<{ email: string }>(profile).email).toBe(updatedEmail);

    const [currentSession, siblingSession] = await Promise.all([
      prisma.authSession.findUniqueOrThrow({ where: { id: actor.sid } }),
      prisma.authSession.findUniqueOrThrow({ where: { id: sibling.sid } }),
    ]);
    expect(currentSession.revokedAt).toBeNull();
    expect(siblingSession.revokedAt).not.toBeNull();
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: currentBinding.bindingId },
      }),
    ).toMatchObject({ state: 'ACTIVE', expoToken: currentToken });

    const nextOwner = await createActor(Role.PROFESSOR);
    const nextIdentity = proof();
    const nextBinding = bodyAs<PushBinding>(
      await reserve(nextOwner, nextIdentity),
    );
    await activate(nextOwner, nextIdentity, nextBinding, siblingToken);

    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: siblingBinding.bindingId },
      }),
    ).toMatchObject({
      state: 'INVALID',
      reason: 'SESSION_INACTIVE',
      expoToken: null,
    });
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: nextBinding.bindingId },
      }),
    ).toMatchObject({ state: 'ACTIVE', expoToken: siblingToken });
  });

  it('keeps eight account/session/installation bindings independent and refresh keeps the same sid', async () => {
    const accounts = await Promise.all([
      createActor(Role.PARENT),
      createActor(Role.PROFESSOR),
    ]);
    const sessions = await Promise.all(
      accounts.map(
        async (actor) => [actor, await createSiblingSession(actor)] as const,
      ),
    );
    const activeBindings: Array<{
      actor: PushActor;
      identity: ReturnType<typeof proof>;
      binding: PushBinding;
    }> = [];

    for (const accountSessions of sessions) {
      for (const actor of accountSessions) {
        for (let deviceIndex = 0; deviceIndex < 2; deviceIndex += 1) {
          const identity = proof();
          const binding = bodyAs<PushBinding>(await reserve(actor, identity));
          await activate(
            actor,
            identity,
            binding,
            `ExpoPushToken[synthetic-matrix-${randomUUID().replace(/-/g, '')}]`,
          );
          activeBindings.push({ actor, identity, binding });
        }
      }
    }

    expect(activeBindings).toHaveLength(8);
    expect(
      await prisma.pushRegistration.count({ where: { state: 'ACTIVE' } }),
    ).toBe(8);
    const refreshed = await signRefreshedActor(activeBindings[0].actor);
    const refreshedState = await authenticated(
      'get',
      '/api/v1/push/installation',
      refreshed,
      activeBindings[0].identity,
    ).expect(200);
    expect(bodyAs<PushState>(refreshedState).state).toBe('ACTIVE');

    await prisma.authSession.update({
      where: { id: sessions[0][1].sid },
      data: { revokedAt: new Date() },
    });
    await prisma.authSession.update({
      where: { id: sessions[1][1].sid },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const eligibleSessions = [sessions[0][0].sid, sessions[1][0].sid];
    expect(
      await prisma.pushRegistration.count({
        where: { state: 'ACTIVE', sessionId: { in: eligibleSessions } },
      }),
    ).toBe(4);
    expect(
      await prisma.pushRegistration.count({
        where: {
          state: 'ACTIVE',
          sessionId: { in: [sessions[0][1].sid, sessions[1][1].sid] },
        },
      }),
    ).toBe(4);
    for (const item of activeBindings.filter(({ actor }) =>
      eligibleSessions.includes(actor.sid),
    )) {
      const state = await authenticated(
        'get',
        '/api/v1/push/installation',
        item.actor,
        item.identity,
      ).expect(200);
      expect(bodyAs<PushState>(state).state).toBe('ACTIVE');
    }
    expect(await prisma.pushTestAttempt.count()).toBe(0);
  });

  it('cleans ineligible and aged bindings while preserving eligible and recent rows', async () => {
    const now = new Date();
    const stale = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const liveActor = await createActor();
    const revokedActor = await createActor();
    const expiredActor = await createActor();

    async function activeBinding(actor: PushActor, token: string) {
      const identity = proof();
      const binding = bodyAs<PushBinding>(await reserve(actor, identity));
      await activate(actor, identity, binding, token);
      const registration = await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: binding.bindingId },
      });
      return { identity, binding, registration };
    }

    async function addAttempt(registration: {
      id: string;
      installationId: string;
      tokenRevision: number;
      tokenFingerprint: string | null;
    }) {
      if (!registration.tokenFingerprint)
        throw new Error('Expected an active fixture');
      return prisma.pushTestAttempt.create({
        data: {
          installationId: registration.installationId,
          registrationId: registration.id,
          tokenRevision: registration.tokenRevision,
          tokenFingerprint: registration.tokenFingerprint,
          state: 'ACCEPTED',
          acceptedAt: now,
        },
      });
    }

    const live = await activeBinding(
      liveActor,
      'ExpoPushToken[synthetic-clean-live-01]',
    );
    const liveAttempt = await addAttempt(live.registration);
    await prisma.pushInstallation.update({
      where: { id: live.identity.installationId },
      data: { createdAt: stale, updatedAt: stale },
    });

    const revoked = await activeBinding(
      revokedActor,
      'ExpoPushToken[synthetic-clean-revoked-02]',
    );
    const revokedAttempt = await addAttempt(revoked.registration);
    await prisma.authSession.update({
      where: { id: revokedActor.sid },
      data: { revokedAt: now },
    });

    const expired = await activeBinding(
      expiredActor,
      'ExpoPushToken[synthetic-clean-expired-03]',
    );
    const expiredAttempt = await addAttempt(expired.registration);
    await prisma.authSession.update({
      where: { id: expiredActor.sid },
      data: { expiresAt: new Date(now.getTime() - 1) },
    });

    const reservedIdentity = proof();
    const oldReserved = bodyAs<PushBinding>(
      await reserve(liveActor, reservedIdentity),
    );
    await prisma.pushRegistration.update({
      where: { id: oldReserved.bindingId },
      data: { updatedAt: stale },
    });
    await prisma.pushInstallation.update({
      where: { id: reservedIdentity.installationId },
      data: { createdAt: stale, updatedAt: stale },
    });

    const revokedTerminal = await activeBinding(
      liveActor,
      'ExpoPushToken[synthetic-clean-terminal-04]',
    );
    const revokedTerminalAttempt = await addAttempt(
      revokedTerminal.registration,
    );
    await authenticated(
      'delete',
      '/api/v1/push/installation',
      liveActor,
      revokedTerminal.identity,
    )
      .send({
        ...bindingRequest(revokedTerminal.binding),
        reason: 'USER_DISABLED',
      })
      .expect(204);
    await prisma.pushRegistration.update({
      where: { id: revokedTerminal.binding.bindingId },
      data: { updatedAt: stale },
    });
    await prisma.pushInstallation.update({
      where: { id: revokedTerminal.identity.installationId },
      data: { createdAt: stale, updatedAt: stale },
    });

    const invalidTerminal = await activeBinding(
      liveActor,
      'ExpoPushToken[synthetic-clean-invalid-05]',
    );
    const invalidTerminalAttempt = await addAttempt(
      invalidTerminal.registration,
    );
    await prisma.pushRegistration.update({
      where: { id: invalidTerminal.binding.bindingId },
      data: {
        state: 'INVALID',
        reason: 'TOKEN_INVALID',
        platform: null,
        expoToken: null,
        tokenFingerprint: null,
        invalidatedAt: now,
        updatedAt: stale,
      },
    });
    await prisma.pushInstallation.update({
      where: { id: invalidTerminal.identity.installationId },
      data: { createdAt: stale, updatedAt: stale },
    });

    const recentTerminal = await activeBinding(
      liveActor,
      'ExpoPushToken[synthetic-clean-recent-06]',
    );
    await authenticated(
      'delete',
      '/api/v1/push/installation',
      liveActor,
      recentTerminal.identity,
    )
      .send({
        ...bindingRequest(recentTerminal.binding),
        reason: 'USER_DISABLED',
      })
      .expect(204);

    const orphanId = randomUUID();
    await prisma.pushInstallation.create({
      data: {
        id: orphanId,
        secretHash: createHash('sha256').update(randomUUID()).digest('hex'),
        lifecycleVersion: 0,
        createdAt: stale,
        updatedAt: stale,
      },
    });
    const recentOrphanId = randomUUID();
    await prisma.pushInstallation.create({
      data: {
        id: recentOrphanId,
        secretHash: createHash('sha256').update(randomUUID()).digest('hex'),
        lifecycleVersion: 0,
      },
    });

    const result = await new PushRegistrationService(
      prisma,
    ).cleanupInactiveRegistrations(now);

    expect(result).toEqual({
      registrationsDeleted: 5,
      installationsDeleted: 4,
    });
    expect(
      await prisma.pushRegistration.findUnique({
        where: { id: live.binding.bindingId },
      }),
    ).toMatchObject({ state: 'ACTIVE', userId: liveActor.id });
    expect(
      await prisma.pushRegistration.findUnique({
        where: { id: recentTerminal.binding.bindingId },
      }),
    ).toMatchObject({ state: 'REVOKED', reason: 'USER_DISABLED' });
    for (const id of [
      revoked.binding.bindingId,
      expired.binding.bindingId,
      oldReserved.bindingId,
      revokedTerminal.binding.bindingId,
      invalidTerminal.binding.bindingId,
    ]) {
      await expect(
        prisma.pushRegistration.findUnique({ where: { id } }),
      ).resolves.toBeNull();
    }
    for (const id of [
      revokedAttempt.id,
      expiredAttempt.id,
      revokedTerminalAttempt.id,
      invalidTerminalAttempt.id,
    ]) {
      await expect(
        prisma.pushTestAttempt.findUnique({ where: { id } }),
      ).resolves.toBeNull();
    }
    await expect(
      prisma.pushTestAttempt.findUnique({ where: { id: liveAttempt.id } }),
    ).resolves.toMatchObject({ registrationId: live.registration.id });
    await expect(
      prisma.pushInstallation.findUnique({ where: { id: orphanId } }),
    ).resolves.toBeNull();
    await expect(
      prisma.pushInstallation.findUnique({ where: { id: recentOrphanId } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.pushInstallation.findUnique({
        where: { id: live.identity.installationId },
      }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.pushInstallation.findUnique({
        where: { id: revoked.identity.installationId },
      }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.pushInstallation.findUnique({
        where: { id: expired.identity.installationId },
      }),
    ).resolves.not.toBeNull();
    await request(app.getHttpServer())
      .delete('/api/v1/push/installation')
      .set('X-Push-Installation', revokedTerminal.identity.installationId)
      .set('X-Push-Capability', revokedTerminal.identity.capability)
      .send({
        ...bindingRequest(revokedTerminal.binding),
        reason: 'USER_DISABLED',
      })
      .expect(204);
  });
});
