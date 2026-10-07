import { randomBytes, randomUUID } from 'node:crypto';
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
type PushIdentity = { installationId: string; capability: string };

const installationPath = '/api/v1/push/installation';

describe('Push lifecycle PostgreSQL concurrency', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let previousEnabled: string | undefined;
  let previousAccessToken: string | undefined;

  async function createActor(role: Role = Role.PARENT): Promise<PushActor> {
    const user = await prisma.user.create({
      data: {
        name: `Push concurrency ${role}`,
        email: `push-concurrency-${randomUUID()}@example.test`,
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
    return actorFor(user.id, user.email, role, session.id);
  }

  function actorFor(
    id: string,
    email: string,
    role: Role,
    sid: string,
  ): PushActor {
    const accessToken = app.get(JwtService).sign(
      { sub: id, sid, email, role },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    return { id, sid, accessToken };
  }

  function proof(): PushIdentity {
    return {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
  }

  function authenticated(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    actor: PushActor,
    identity: PushIdentity,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .auth(actor.accessToken, { type: 'bearer' })
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', identity.capability);
  }

  async function reserve(actor: PushActor, identity: PushIdentity) {
    return authenticated('post', `${installationPath}/reserve`, actor, identity)
      .send({})
      .expect(200);
  }

  function activate(
    actor: PushActor,
    identity: PushIdentity,
    binding: Pick<PushBinding, 'bindingId' | 'lifecycleVersion'>,
    expoToken: string,
    expectedTokenRevision = 0,
  ) {
    return authenticated('put', installationPath, actor, identity).send({
      bindingId: binding.bindingId,
      lifecycleVersion: binding.lifecycleVersion,
      expectedTokenRevision,
      platform: 'ANDROID',
      expoToken,
      permission: 'GRANTED',
    });
  }

  async function revoke(
    actor: PushActor,
    identity: PushIdentity,
    binding: Pick<PushBinding, 'bindingId' | 'lifecycleVersion'>,
  ) {
    return authenticated('delete', installationPath, actor, identity)
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        reason: 'USER_DISABLED',
      })
      .expect(204);
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

  it('serializes simultaneous claims for one eligible token and preserves the winner', async () => {
    const actor = await createActor();
    const firstIdentity = proof();
    const secondIdentity = proof();
    const firstBinding = (await reserve(actor, firstIdentity))
      .body as PushBinding;
    const secondBinding = (await reserve(actor, secondIdentity))
      .body as PushBinding;
    const sharedToken = 'ExpoPushToken[synthetic-racing-token-01]';

    const results = await Promise.all([
      activate(actor, firstIdentity, firstBinding, sharedToken),
      activate(actor, secondIdentity, secondBinding, sharedToken),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    const active = await prisma.pushRegistration.findMany({
      where: { state: 'ACTIVE', expoToken: sharedToken },
    });
    expect(active).toHaveLength(1);
    expect(active[0]?.userId).toBe(actor.id);
    expect(
      await prisma.pushRegistration.count({
        where: { expoToken: sharedToken },
      }),
    ).toBe(1);
  });

  it('releases an ineligible old session token atomically before a new account claims it', async () => {
    const previousOwner = await createActor();
    const newOwner = await createActor(Role.PROFESSOR);
    const oldIdentity = proof();
    const newIdentity = proof();
    const oldBinding = (await reserve(previousOwner, oldIdentity))
      .body as PushBinding;
    const sharedToken = 'ExpoPushToken[synthetic-released-token-02]';
    await activate(previousOwner, oldIdentity, oldBinding, sharedToken).expect(
      200,
    );
    const before = await prisma.pushRegistration.findUniqueOrThrow({
      where: { id: oldBinding.bindingId },
    });
    await prisma.authSession.update({
      where: { id: previousOwner.sid },
      data: { revokedAt: new Date() },
    });
    const newBinding = (await reserve(newOwner, newIdentity))
      .body as PushBinding;

    await activate(newOwner, newIdentity, newBinding, sharedToken).expect(200);

    const after = await prisma.pushRegistration.findUniqueOrThrow({
      where: { id: oldBinding.bindingId },
    });
    expect(after).toMatchObject({
      state: 'INVALID',
      reason: 'SESSION_INACTIVE',
    });
    expect(after.expoToken).toBeNull();
    expect(after.tokenRevision).toBe(before.tokenRevision);
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: newBinding.bindingId },
      }),
    ).toMatchObject({ state: 'ACTIVE', expoToken: sharedToken });
  });

  it('keeps DELETE terminal when a token rotation races its PUT', async () => {
    const actor = await createActor();
    const identity = proof();
    const binding = (await reserve(actor, identity)).body as PushBinding;
    await activate(
      actor,
      identity,
      binding,
      'ExpoPushToken[synthetic-before-rotate-03]',
    ).expect(200);

    const [putResult, deleteResult] = await Promise.all([
      activate(
        actor,
        identity,
        binding,
        'ExpoPushToken[synthetic-after-rotate-04]',
        1,
      ),
      revoke(actor, identity, binding),
    ]);

    expect([200, 409]).toContain(putResult.status);
    expect(deleteResult.status).toBe(204);
    const registration = await prisma.pushRegistration.findUniqueOrThrow({
      where: { id: binding.bindingId },
    });
    expect(registration.state).toBe('REVOKED');
    expect(registration.expoToken).toBeNull();
    expect(registration.tokenFingerprint).toBeNull();
  });

  it('revalidates the authenticated session again inside the transaction', async () => {
    const actor = await createActor();
    const identity = proof();
    await prisma.authSession.update({
      where: { id: actor.sid },
      data: { revokedAt: new Date() },
    });

    await expect(
      app
        .get(PushRegistrationService)
        .reserve({ userId: actor.id, sessionId: actor.sid }, identity),
    ).rejects.toMatchObject({ status: 401 });
    expect(await prisma.pushInstallation.count()).toBe(0);
    expect(await prisma.pushRegistration.count()).toBe(0);
  });
});
