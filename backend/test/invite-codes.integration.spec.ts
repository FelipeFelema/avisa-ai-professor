/* Supertest bodies are dynamically typed; assertions narrow each contract locally. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';
import * as inviteCodeRandom from '../src/invites-code/invite-code-random';
import request from 'supertest';
import { App } from 'supertest/types';
import { InviteCodeService } from '../src/invites-code/invite-code.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';
import { createAdminUserAndLogin } from './helpers/admin-user.helper';

type AdminAuth = { user: { id: string }; accessToken: string };
type HttpRegistration = { id: string; role: Role; access_token: string };

describe('Invite code PostgreSQL integration', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let invites: InviteCodeService;
  const prefix = `ic-${crypto.randomUUID().replaceAll('-', '')}`;
  const password = 'test-pass-123';
  const email = (tag: string) => `${prefix}-${tag}@email.com`;
  const code = (tag: string) => `LEGACY-${prefix}-${tag}`;

  async function admin(tag: string): Promise<AdminAuth> {
    return createAdminUserAndLogin(app, prisma, {
      email: email(`admin-${tag}`),
      password,
    });
  }

  async function makeInvite(
    inviteCode: string,
    role: Role = Role.PROFESSOR,
    expiresAt = new Date(Date.now() + 60 * 60_000),
  ) {
    return prisma.inviteCode.create({
      data: { code: inviteCode, role, expiresAt },
    });
  }

  async function register(inviteCode: string, address: string) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', `${prefix}-${address}`)
      .send({
        name: 'Invite Integration Professor',
        email: address,
        password,
        teacherCode: inviteCode,
      });
  }

  beforeAll(async () => {
    assertSafeTestDatabase();
    app = (await createTestApp({
      configureBuilder: (builder) =>
        builder
          .overrideGuard(RateLimitGuard)
          .useValue({ canActivate: () => true }),
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
    invites = app.get(InviteCodeService);
    await clearTestDatabase(prisma);
  });

  beforeEach(async () => clearTestDatabase(prisma));
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await app.close();
  });

  it('authorizes from the current database user and emits an exact seven-day PROFESSOR invite', async () => {
    const auth = await admin('issue');
    const response = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(201);
    const created = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: response.body.id as string },
    });

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.role).toBe(Role.PROFESSOR);
    expect(response.body.isActive).toBe(true);
    expect(response.body.code).toMatch(/^PROF-[A-F0-9]{32}$/);
    expect(created.expiresAt.getTime() - created.createdAt.getTime()).toBe(
      604800000,
    );
  });

  it('keeps deliberate subsequent invitations independent and historical ADMIN rows unchanged', async () => {
    const auth = await admin('deliberate-subsequent');
    const historicalAdmin = await makeInvite(
      code('deliberate-historical-admin'),
      Role.ADMIN,
    );

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(201);
    const secondResponse = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(201);

    const firstCode = firstResponse.body.code as string;
    const secondCode = secondResponse.body.code as string;
    expect(firstResponse.body.id).not.toBe(secondResponse.body.id);
    expect(firstCode).not.toBe(secondCode);

    const firstBefore = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: firstResponse.body.id as string },
    });
    const secondBefore = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: secondResponse.body.id as string },
    });
    const historicalBefore = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: historicalAdmin.id },
    });
    expect(firstBefore).toMatchObject({
      code: firstCode,
      role: Role.PROFESSOR,
      isActive: true,
    });
    expect(secondBefore).toMatchObject({
      code: secondCode,
      role: Role.PROFESSOR,
      isActive: true,
    });
    expect(
      firstBefore.expiresAt.getTime() - firstBefore.createdAt.getTime(),
    ).toBe(604800000);
    expect(
      secondBefore.expiresAt.getTime() - secondBefore.createdAt.getTime(),
    ).toBe(604800000);

    expect((await register(firstCode, email('deliberate-first'))).status).toBe(
      201,
    );
    const firstAfterConsumption = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: firstBefore.id },
    });
    const secondAfterFirstConsumption =
      await prisma.inviteCode.findUniqueOrThrow({
        where: { id: secondBefore.id },
      });
    const historicalAfterFirstConsumption =
      await prisma.inviteCode.findUniqueOrThrow({
        where: { id: historicalBefore.id },
      });
    expect(firstAfterConsumption).toMatchObject({
      code: firstBefore.code,
      role: Role.PROFESSOR,
      isActive: false,
      createdAt: firstBefore.createdAt,
      expiresAt: firstBefore.expiresAt,
    });
    expect(firstAfterConsumption.updatedAt.getTime()).toBeGreaterThan(
      firstBefore.updatedAt.getTime(),
    );
    expect(secondAfterFirstConsumption).toEqual(secondBefore);
    expect(historicalAfterFirstConsumption).toEqual(historicalBefore);

    expect(
      (await register(secondCode, email('deliberate-second'))).status,
    ).toBe(201);
    const secondAfterConsumption = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: secondBefore.id },
    });
    const historicalAfterSecondConsumption =
      await prisma.inviteCode.findUniqueOrThrow({
        where: { id: historicalBefore.id },
      });
    expect(secondAfterConsumption).toMatchObject({
      code: secondBefore.code,
      role: Role.PROFESSOR,
      isActive: false,
      createdAt: secondBefore.createdAt,
      expiresAt: secondBefore.expiresAt,
    });
    expect(secondAfterConsumption.updatedAt.getTime()).toBeGreaterThan(
      secondBefore.updatedAt.getTime(),
    );
    expect(historicalAfterSecondConsumption).toEqual(historicalBefore);
  });

  it('leaves the first and historical ADMIN invitations unchanged after a failed second issuance', async () => {
    const auth = await admin('failed-subsequent');
    const historicalAdmin = await makeInvite(
      code('failed-historical-admin'),
      Role.ADMIN,
    );
    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(201);
    const firstBefore = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: firstResponse.body.id as string },
    });
    const historicalBefore = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: historicalAdmin.id },
    });
    const firstBytes = Buffer.from(
      firstBefore.code.slice('PROF-'.length),
      'hex',
    );
    const collisionMock = jest
      .spyOn(inviteCodeRandom, 'randomInviteCodeBytes')
      .mockImplementation((size) => Buffer.from(firstBytes).subarray(0, size));

    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(503);
    expect(collisionMock).toHaveBeenCalledTimes(3);

    const firstAfter = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: firstBefore.id },
    });
    const historicalAfter = await prisma.inviteCode.findUniqueOrThrow({
      where: { id: historicalBefore.id },
    });
    expect(firstAfter).toEqual(firstBefore);
    expect(historicalAfter).toEqual(historicalBefore);
    expect(await prisma.inviteCode.count()).toBe(2);
  });

  it('locks User before AuthSession in the issuance transaction', async () => {
    const auth = await admin('lock-order');
    const lockSql: string[] = [];
    const original = prisma.$transaction.bind(prisma) as (
      work: (tx: any) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>;
    jest.spyOn(prisma, '$transaction').mockImplementation(((
      work: (tx: any) => Promise<unknown>,
      options?: unknown,
    ) =>
      original(async (tx) => {
        const wrapped = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === '$queryRaw') {
              return (...args: unknown[]) => {
                lockSql.push((args[0] as TemplateStringsArray).join(' '));
                return target.$queryRaw(...args);
              };
            }
            return Reflect.get(target, property, receiver);
          },
        });
        return work(wrapped);
      }, options)) as never);

    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(201);
    expect(lockSql[0]).toContain('FROM "User"');
    expect(lockSql[0]).toContain('FOR UPDATE');
    expect(lockSql[1]).toContain('FROM "AuthSession"');
    expect(lockSql[1]).toContain('FOR UPDATE');
  });

  it('revalidates role after the ADMIN guard and writes no invitation after demotion', async () => {
    const auth = await admin('demote-race');
    const original = invites.createInviteCode.bind(invites);
    jest
      .spyOn(invites, 'createInviteCode')
      .mockImplementation(async (actorId, sid) => {
        await prisma.user.update({
          where: { id: actorId },
          data: { role: Role.PARENT },
        });
        return original(actorId, sid);
      });

    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(403);
    expect(await prisma.inviteCode.count()).toBe(0);
  });

  it('revalidates a session revoked after the guard and creates nothing', async () => {
    const auth = await admin('revoke-race');
    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: auth.user.id },
    });
    const original = invites.createInviteCode.bind(invites);
    jest
      .spyOn(invites, 'createInviteCode')
      .mockImplementation(async (actorId, sid) => {
        await prisma.authSession.update({
          where: { id: sid },
          data: { revokedAt: new Date() },
        });
        return original(actorId, sid);
      });

    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(401);
    expect(session.userId).toBe(auth.user.id);
    expect(await prisma.inviteCode.count()).toBe(0);
  });

  it('uses three distinct secret attempts for code collisions and sanitizes other persistence failures', async () => {
    const auth = await admin('collision');
    const collisionBytes = Buffer.alloc(16, 0xa5);
    const collisionCode = `PROF-${collisionBytes.toString('hex').toUpperCase()}`;
    await makeInvite(collisionCode);
    const collisionMock = jest
      .spyOn(inviteCodeRandom, 'randomInviteCodeBytes')
      .mockImplementation((size) => Buffer.alloc(size, 0xa5));

    const exhausted = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(503);
    expect(collisionMock).toHaveBeenCalledTimes(3);
    expect(exhausted.status).toBe(503);
    expect(exhausted.body.message).toBe(
      'Não foi possível gerar o convite. Tente novamente.',
    );
    expect(await prisma.inviteCode.count()).toBe(1);
    collisionMock.mockRestore();

    const unrelatedUniqueError = Object.assign(
      new Error('SYNTHETIC_OTHER_UNIQUE'),
      { code: 'P2002', meta: { target: ['id'] } },
    );
    const unrelatedTransaction = jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValue(unrelatedUniqueError);
    await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(500);
    expect(unrelatedTransaction).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();

    jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValue(new Error('SYNTHETIC_DRIVER_SECRET'));
    const failure = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(500);
    expect(JSON.stringify(failure.body)).not.toContain(
      'SYNTHETIC_DRIVER_SECRET',
    );
    expect(await prisma.inviteCode.count()).toBe(1);
  });

  it('serializes two different-email consumers so exactly one account uses a code', async () => {
    const inviteCode = code('parallel-consume');
    await makeInvite(inviteCode);
    const results = await Promise.all([
      register(inviteCode, email('parallel-a')),
      register(inviteCode, email('parallel-b')),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 400]);
    const rejected = results.find((result) => result.status === 400);
    expect(rejected?.body.message).toBe(
      'Código de convite inválido ou indisponível.',
    );
    expect(
      await prisma.user.count({ where: { email: { startsWith: prefix } } }),
    ).toBe(1);
    expect(
      await prisma.inviteCode.findUniqueOrThrow({
        where: { code: inviteCode },
      }),
    ).toMatchObject({ isActive: false });
  });

  it('rolls back a second invite when concurrent registrations race on one email', async () => {
    const firstCode = code('same-email-a');
    const secondCode = code('same-email-b');
    await makeInvite(firstCode);
    await makeInvite(secondCode);
    const address = email('same-email');
    const results = await Promise.all([
      register(firstCode, address),
      register(secondCode, address),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const inviteRows = await prisma.inviteCode.findMany({
      where: { code: { in: [firstCode, secondCode] } },
      orderBy: { code: 'asc' },
    });
    expect(inviteRows.filter((invite) => invite.isActive)).toHaveLength(1);
    expect(await prisma.user.count({ where: { email: address } })).toBe(1);
  });

  it('leaves historical ADMIN/PARENT invites untouched and accepts a legacy PROFESSOR code', async () => {
    const adminCode = code('historical-admin');
    const parentCode = code('historical-parent');
    const legacyProfessorCode = `OLD-${prefix}-PROF`;
    await makeInvite(adminCode, Role.ADMIN);
    await makeInvite(parentCode, Role.PARENT);
    await makeInvite(legacyProfessorCode);

    const adminResult = await register(adminCode, email('historical-admin'));
    const parentResult = await register(parentCode, email('historical-parent'));
    expect(adminResult.status).toBe(400);
    expect(parentResult.status).toBe(400);
    expect(adminResult.body.message).toBe(parentResult.body.message);
    expect(adminResult.body.message).toBe(
      'Código de convite inválido ou indisponível.',
    );
    expect(
      await prisma.inviteCode.findMany({
        where: { code: { in: [adminCode, parentCode] } },
        select: { isActive: true },
      }),
    ).toEqual([{ isActive: true }, { isActive: true }]);

    const professor = await register(legacyProfessorCode, email('legacy-prof'));
    expect(professor.status).toBe(201);
    expect((professor.body as HttpRegistration).role).toBe(Role.PROFESSOR);
  });

  it('rejects exact-boundary expired invites and updates consumed timestamps in UTC under a non-UTC session', async () => {
    const expiredCode = code('exact-expiry');
    await makeInvite(expiredCode, Role.PROFESSOR, new Date(Date.now() - 1));
    const expiredTx = await prisma.$transaction(async (tx) => {
      await expect(
        invites.consumeInviteCode(tx, expiredCode),
      ).rejects.toMatchObject({
        response: { message: 'Código de convite inválido ou indisponível.' },
      });
      return true;
    });
    expect(expiredTx).toBe(true);
    expect(
      await prisma.inviteCode.findUniqueOrThrow({
        where: { code: expiredCode },
      }),
    ).toMatchObject({ isActive: true });

    const validCode = code('utc-consume');
    await makeInvite(validCode);
    await prisma.inviteCode.update({
      where: { code: validCode },
      data: { createdAt: new Date('2000-01-01T00:00:00.000Z') },
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'America/Los_Angeles'`;
      await invites.consumeInviteCode(tx, validCode);
      const [zone] = await tx.$queryRaw<Array<{ zone: string }>>`
        SELECT current_setting('TimeZone') AS zone
      `;
      expect(zone?.zone).toBe('America/Los_Angeles');
      const [timestamps] = await tx.$queryRaw<
        Array<{ createdMs: string; updatedMs: string }>
      >`
        SELECT
          (EXTRACT(EPOCH FROM ("createdAt" AT TIME ZONE 'UTC')) * 1000)::text AS "createdMs",
          (EXTRACT(EPOCH FROM ("updatedAt" AT TIME ZONE 'UTC')) * 1000)::text AS "updatedMs"
        FROM "InviteCode" WHERE "code" = ${validCode}
      `;
      expect(Number(timestamps?.updatedMs)).toBeGreaterThan(
        Number(timestamps?.createdMs),
      );
    });
    expect(
      await prisma.inviteCode.findUniqueOrThrow({ where: { code: validCode } }),
    ).toMatchObject({ isActive: false });
    const boundaryCode = code('exact-boundary');
    await makeInvite(boundaryCode);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "InviteCode" WHERE "code" = ${boundaryCode} FOR UPDATE`;
      await tx.$executeRaw`
        UPDATE "InviteCode"
        SET "expiresAt" = (clock_timestamp() AT TIME ZONE 'UTC')
        WHERE "code" = ${boundaryCode}
      `;
      await expect(
        invites.consumeInviteCode(tx, boundaryCode),
      ).rejects.toMatchObject({
        response: { message: 'Código de convite inválido ou indisponível.' },
      });
    });
  });

  it('rejects an invite that expires while registration waits for its row lock', async () => {
    const inviteCode = code('lock-expiry');
    await makeInvite(inviteCode);
    let releaseLock!: () => void;
    let lockAcquired!: () => void;
    const released = new Promise<void>((resolve) => (releaseLock = resolve));
    const acquired = new Promise<void>((resolve) => (lockAcquired = resolve));
    const blocker = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "InviteCode" WHERE "code" = ${inviteCode} FOR UPDATE`;
        await tx.$executeRaw`
        UPDATE "InviteCode"
        SET "expiresAt" = (clock_timestamp() AT TIME ZONE 'UTC')
        WHERE "code" = ${inviteCode}
      `;
        lockAcquired();
        await released;
      },
      { timeout: 15000 },
    );
    await acquired;

    const attempt = register(inviteCode, email('waited-expired'));
    const attemptResponse = attempt.then((response) => response);
    const deadline = Date.now() + 5000;
    let waiting = false;
    while (!waiting && Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%InviteCode%'
          AND query ILIKE '%FOR UPDATE%'
      `;
      waiting = Number(rows[0]?.count ?? 0) > 0;
      if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    try {
      expect(waiting).toBe(true);
    } finally {
      releaseLock();
    }
    await blocker;
    const response = await attemptResponse;
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Código de convite inválido ou indisponível.',
    );
    expect(
      await prisma.inviteCode.findUniqueOrThrow({
        where: { code: inviteCode },
      }),
    ).toMatchObject({ isActive: true });
  });
});
