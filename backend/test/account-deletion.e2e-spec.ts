import { INestApplication } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountDeletionService } from '../src/users/account-deletion.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';
import {
  createAccountFixture,
  cleanupAccountFixture,
  snapshotDatabase,
} from './helpers/account-deletion.helper';

describe('Account deletion HTTP contracts', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  beforeAll(async () => {
    assertSafeTestDatabase();
    app = (await createTestApp({
      configureBuilder: (builder) =>
        builder
          .overrideGuard(RateLimitGuard)
          .useValue({ canActivate: () => true }),
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
    await clearTestDatabase(prisma);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await clearTestDatabase(prisma);
  });
  afterAll(async () => {
    await app.close();
  });
  function token(id: string, sid: string) {
    return app.get(JwtService).sign(
      { sub: id, sid, email: 'stale@example.com', role: 'PARENT' },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
  }
  it.each(Object.values(Role))(
    'returns the actual/historical %s graph without changing any table/session',
    async (role) => {
      const fixture = await createAccountFixture(prisma, { role });
      const before = await snapshotDatabase(prisma);
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/account-deletion')
        .auth(token(fixture.target.id, fixture.sessions[0].id), {
          type: 'bearer',
        })
        .expect(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual({
        role,
        canDelete: true,
        blockReason: null,
        ownedClassroomsCount: 2,
        announcementsInOwnedClassroomsCount: 3,
        externalMembershipsCount: 1,
        authoredAnnouncementsInOtherClassroomsCount: 1,
      });
      expect(await snapshotDatabase(prisma)).toEqual(before);
      await cleanupAccountFixture(prisma, fixture);
    },
  );
  it.each([1, 2] as const)(
    'uses current last-ADMIN eligibility with %s ADMINs and zero relations',
    async (adminCount) => {
      const f = await createAccountFixture(prisma, {
        role: Role.ADMIN,
        adminCount,
        empty: true,
      });
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/account-deletion')
        .auth(token(f.target.id, f.sessions[0].id), { type: 'bearer' })
        .expect(200);
      expect(response.body).toEqual({
        role: 'ADMIN',
        canDelete: adminCount === 2,
        blockReason: adminCount === 1 ? 'LAST_ADMIN_REQUIRED' : null,
        ownedClassroomsCount: 0,
        announcementsInOwnedClassroomsCount: 0,
        externalMembershipsCount: 0,
        authoredAnnouncementsInOtherClassroomsCount: 0,
      });
    },
  );
  it.each([
    'absent',
    'revoked',
    'expired',
    'foreign',
    'missing-user',
    'no-token',
  ])('rejects %s authentication safely', async (kind) => {
    const f = await createAccountFixture(prisma, {
      role: Role.PARENT,
      empty: true,
    });
    const sid =
      kind === 'expired'
        ? f.sessions[3].id
        : kind === 'revoked'
          ? f.sessions[4].id
          : kind === 'foreign'
            ? f.sessions[2].id
            : 'missing';
    const before = await snapshotDatabase(prisma);
    const call = request(app.getHttpServer()).get(
      '/api/v1/users/account-deletion',
    );
    if (kind !== 'no-token')
      call.auth(token(kind === 'missing-user' ? 'missing' : f.target.id, sid), {
        type: 'bearer',
      });
    const response = await call.expect(401);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(await snapshotDatabase(prisma)).toEqual(before);
  });
  it.each(['id', 'userId', 'accountId', 'role', 'email'])(
    'rejects %s selectors and GET JSON without writes',
    async (key) => {
      const f = await createAccountFixture(prisma, { role: Role.PARENT });
      const auth = token(f.target.id, f.sessions[0].id);
      const before = await snapshotDatabase(prisma);
      await request(app.getHttpServer())
        .get(`/api/v1/users/account-deletion?${key}=other`)
        .auth(auth, { type: 'bearer' })
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/v1/users/account-deletion')
        .auth(auth, { type: 'bearer' })
        .send({ [key]: 'other' })
        .expect(400);
      expect(await snapshotDatabase(prisma)).toEqual(before);
    },
  );
  it('sanitizes GET failures and protects account deletion behind JWT', async () => {
    const f = await createAccountFixture(prisma, { role: Role.PARENT });
    const auth = token(f.target.id, f.sessions[0].id);
    jest
      .spyOn(app.get(AccountDeletionService), 'getImpact')
      .mockRejectedValueOnce(new Error('SYNTHETIC_SECRET_SQL'));
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/account-deletion')
      .auth(auth, { type: 'bearer' })
      .expect(500);
    expect(JSON.stringify(response.body)).not.toContain('SYNTHETIC_SECRET_SQL');
    expect(response.headers['cache-control']).toBe('no-store');
    const unauthorizedDelete = await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .expect(401);
    expect(unauthorizedDelete.headers['cache-control']).toBe('no-store');
  });

  it('keeps counts in the same real PostgreSQL snapshot when relations change between reads', async () => {
    const f = await createAccountFixture(prisma, { role: Role.PROFESSOR });
    const original = prisma.$transaction.bind(prisma) as (
      work: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
    ) => Promise<unknown>;
    let inserted = false;
    const spy = jest.spyOn(prisma, '$transaction');
    // Narrow adapter for Prisma's overloaded transaction signature.
    spy.mockImplementation(((
      work: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
    ) =>
      original(async (tx) => {
        const read = (args: Prisma.UserFindUniqueArgs) =>
          tx.user.findUnique(args);
        const user = new Proxy(tx.user, {
          get(target, key) {
            if (key !== 'findUnique')
              return Reflect.get(target, key) as unknown;
            return async (...args: Parameters<typeof read>) => {
              const result = await read(...args);
              if (!inserted) {
                inserted = true;
                await prisma.classroom.create({
                  data: {
                    name: 'Concurrent synthetic classroom',
                    ownerId: f.target.id,
                  },
                });
              }
              return result;
            };
          },
        });
        return work(
          new Proxy(tx, {
            get(target, key) {
              return key === 'user'
                ? user
                : (Reflect.get(target, key) as unknown);
            },
          }),
        );
      }, options)) as typeof prisma.$transaction);
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/account-deletion')
      .auth(token(f.target.id, f.sessions[0].id), { type: 'bearer' })
      .expect(200);
    spy.mockRestore();
    expect(
      (response.body as { ownedClassroomsCount: number }).ownedClassroomsCount,
    ).toBe(2);
    expect(
      await prisma.classroom.count({ where: { ownerId: f.target.id } }),
    ).toBe(3);
    await request(app.getHttpServer())
      .get('/api/v1/users/account-deletion')
      .auth(token(f.target.id, f.sessions[0].id), { type: 'bearer' })
      .expect(200)
      .expect((res) => {
        expect(
          (res.body as { ownedClassroomsCount: number }).ownedClassroomsCount,
        ).toBe(3);
      });
  });

  it.each(Object.values(Role))(
    'deletes only the authenticated %s identity with an empty 204 and allows a fresh registration',
    async (role) => {
      const f = await createAccountFixture(prisma, { role, adminCount: 2 });
      const oldToken = token(f.target.id, f.sessions[0].id);
      const deletion = await request(app.getHttpServer())
        .delete('/api/v1/users/account')
        .auth(oldToken, { type: 'bearer' })
        .send({
          currentPassword: f.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        })
        .expect(204);
      expect(deletion.text).toBe('');
      expect(deletion.headers['cache-control']).toBe('no-store');
      expect(deletion.body).toEqual({});
      expect(
        await prisma.user.findUnique({ where: { id: f.target.id } }),
      ).toBeNull();
      expect(
        await prisma.authSession.count({ where: { userId: f.target.id } }),
      ).toBe(0);
      expect(
        await prisma.classroomDeletionReceipt.count({
          where: { ownerId: f.target.id },
        }),
      ).toBe(0);

      const registration: Record<string, string> = {
        name: 'Fresh identity',
        email: f.target.email,
        password: f.password,
      };
      if (role !== Role.PARENT) {
        let invite = await prisma.inviteCode.findUniqueOrThrow({
          where: { id: f.inviteIds[0] },
        });
        if (role === Role.ADMIN) {
          invite = await prisma.inviteCode.create({
            data: {
              code: `fresh-admin-${Date.now()}-${Math.random()}`,
              role: Role.ADMIN,
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
          f.inviteIds.push(invite.id);
        }
        registration.teacherCode = invite.code;
      }
      const fresh = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registration)
        .expect(201);
      expect((fresh.body as { id: string }).id).not.toBe(f.target.id);
      expect((fresh.body as { role: Role }).role).toBe(role);
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .auth(oldToken, { type: 'bearer' })
        .expect(401);
      expect(
        await prisma.authSession.count({ where: { userId: f.target.id } }),
      ).toBe(0);
      expect(JSON.stringify(deletion.body)).not.toMatch(
        /token|password|third|admin/i,
      );
    },
  );

  it('rejects malformed requests and a wrong password without changing the database', async () => {
    const f = await createAccountFixture(prisma, { role: Role.PARENT });
    const auth = token(f.target.id, f.sessions[0].id);
    const before = await snapshotDatabase(prisma);
    const invalidBodies = [
      {},
      { currentPassword: f.password },
      {
        currentPassword: f.password,
        confirmationPhrase: ' EXCLUIR MINHA CONTA',
      },
      {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
        userId: f.external.id,
      },
    ];
    for (const body of invalidBodies) {
      await request(app.getHttpServer())
        .delete('/api/v1/users/account')
        .auth(auth, { type: 'bearer' })
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .delete('/api/v1/users/account?userId=other')
      .auth(auth, { type: 'bearer' })
      .send({
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      })
      .expect(400);
    const wrongPassword = await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .auth(auth, { type: 'bearer' })
      .send({
        currentPassword: 'wrong password',
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      })
      .expect(400);
    expect(JSON.stringify(wrongPassword.body)).toContain(
      'CURRENT_PASSWORD_INVALID',
    );
    expect(await snapshotDatabase(prisma)).toEqual(before);
  });

  it('rejects the last ADMIN and repeated/invalid-session requests without leaking internals', async () => {
    const f = await createAccountFixture(prisma, {
      role: Role.ADMIN,
      adminCount: 1,
      empty: true,
    });
    const auth = token(f.target.id, f.sessions[0].id);
    const before = await snapshotDatabase(prisma);
    const blocked = await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .auth(auth, { type: 'bearer' })
      .send({
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      })
      .expect(409);
    expect(JSON.stringify(blocked.body)).toContain('LAST_ADMIN_REQUIRED');
    expect(await snapshotDatabase(prisma)).toEqual(before);

    jest
      .spyOn(app.get(AccountDeletionService), 'deleteOwnAccount')
      .mockRejectedValueOnce(new Error('SYNTHETIC_SECRET_SQL_HASH'));
    const failed = await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .auth(auth, { type: 'bearer' })
      .send({
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      })
      .expect(500);
    expect(JSON.stringify(failed.body)).not.toContain(
      'SYNTHETIC_SECRET_SQL_HASH',
    );
    expect(failed.headers['cache-control']).toBe('no-store');
    jest.restoreAllMocks();

    await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .auth(auth, { type: 'bearer' })
      .send({
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      })
      .expect(409);
  });

  it('returns no-store 401 without authentication and after an account has been deleted', async () => {
    const f = await createAccountFixture(prisma, {
      role: Role.PARENT,
      empty: true,
    });
    const oldToken = token(f.target.id, f.sessions[0].id);
    const anonymous = await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .send({})
      .expect(401);
    expect(anonymous.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .auth(oldToken, { type: 'bearer' })
      .send({
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      })
      .expect(204);
    const repeated = await request(app.getHttpServer())
      .delete('/api/v1/users/account')
      .auth(oldToken, { type: 'bearer' })
      .send({
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      })
      .expect(401);
    expect(repeated.headers['cache-control']).toBe('no-store');
  });
});
