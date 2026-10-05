/* Supertest bodies are dynamically typed; assertions narrow each contract locally. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashPassword } from '../src/common/security/password-hasher';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';
import { createAdminUserAndLogin } from './helpers/admin-user.helper';

type AuthFixture = {
  id: string;
  email: string;
  password: string;
  token: string;
  sid: string;
};
type AuthResponse = {
  id: string;
  role: Role;
  access_token: string;
  refresh_token: string;
};

describe('Invite codes HTTP contracts', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const prefix = `ie-${randomUUID().replaceAll('-', '')}`;
  const password = 'e2e-test-pass-123';
  const email = (tag: string) => `${prefix}-${tag}@email.com`;
  const code = (tag: string) => `OLD-${prefix}-${tag}`;

  async function account(tag: string, role: Role): Promise<AuthFixture> {
    const id = randomUUID();
    const address = email(tag);
    const hashed = await hashPassword(password);
    await prisma.user.create({
      data: {
        id,
        name: `Synthetic ${role}`,
        email: address,
        password: hashed,
        role,
      },
    });
    const sid = randomUUID();
    await prisma.authSession.create({
      data: {
        id: sid,
        userId: id,
        refreshTokenHash: 'synthetic-refresh-hash',
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    return { id, email: address, password, sid, token: sign(id, sid) };
  }

  function sign(id: string, sid: string) {
    return app.get(JwtService).sign(
      { sub: id, sid, email: 'synthetic@email.com', role: Role.ADMIN },
      {
        secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  async function makeInvite(
    inviteCode: string,
    role: Role = Role.PROFESSOR,
    expiresAt = new Date(Date.now() + 60 * 60_000),
    isActive = true,
  ) {
    return prisma.inviteCode.create({
      data: { code: inviteCode, role, expiresAt, isActive },
    });
  }

  function register(address: string, teacherCode?: string) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', `${prefix}-${address}`)
      .send({
        name: 'HTTP Contract User',
        email: address,
        password,
        ...(teacherCode === undefined ? {} : { teacherCode }),
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
    await clearTestDatabase(prisma);
  });

  beforeEach(async () => clearTestDatabase(prisma));
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await app.close();
  });

  it('returns 201 metadata and no-store for ADMIN issuance, then accepts one PROFESSOR use', async () => {
    const admin = await createAdminUserAndLogin(app, prisma, {
      email: email('issuer'),
      password,
    });
    const emitted = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(admin.accessToken, { type: 'bearer' })
      .send({ role: 'PROFESSOR' })
      .expect(201);
    expect(emitted.headers['cache-control']).toBe('no-store');
    expect(typeof emitted.body.id).toBe('string');
    expect(/^PROF-[A-F0-9]{32}$/.test(emitted.body.code)).toBe(true);
    expect(emitted.body.role).toBe(Role.PROFESSOR);
    expect(emitted.body.isActive).toBe(true);
    expect(typeof emitted.body.createdAt).toBe('string');
    expect(typeof emitted.body.expiresAt).toBe('string');
    expect(typeof emitted.body.updatedAt).toBe('string');
    expect(
      Date.parse(emitted.body.expiresAt) - Date.parse(emitted.body.createdAt),
    ).toBe(604800000);

    const created = await register(
      email('professor'),
      emitted.body.code,
    ).expect(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect((created.body as AuthResponse).role).toBe(Role.PROFESSOR);
    await register(email('professor-repeat'), emitted.body.code)
      .expect(400)
      .then((response) => {
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body.message).toBe(
          'Código de convite inválido ou indisponível.',
        );
      });
  });

  it.each([
    'no-token',
    'invalid-token',
    'deleted-user',
    'revoked',
    'expired',
    'unbound-session',
  ])(
    'returns sanitized 401 and performs zero writes for %s issuance',
    async (kind) => {
      let token: string | undefined;
      if (kind !== 'no-token' && kind !== 'invalid-token') {
        const issuer = await account(kind, Role.ADMIN);
        token = issuer.token;
        if (kind === 'deleted-user') {
          await prisma.user.delete({ where: { id: issuer.id } });
        } else if (kind === 'revoked') {
          await prisma.authSession.update({
            where: { id: issuer.sid },
            data: { revokedAt: new Date() },
          });
        } else if (kind === 'expired') {
          await prisma.authSession.update({
            where: { id: issuer.sid },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
        } else if (kind === 'unbound-session') {
          const other = await account('other-session', Role.ADMIN);
          token = sign(issuer.id, other.sid);
        }
      }

      const before = await prisma.inviteCode.count();
      const call = request(app.getHttpServer())
        .post('/api/v1/invite-codes')
        .send({ role: 'PROFESSOR' });
      if (kind === 'invalid-token')
        call.auth('synthetic-invalid', { type: 'bearer' });
      if (token) call.auth(token, { type: 'bearer' });
      const response = await call.expect(401);
      expect(JSON.stringify(response.body)).not.toContain('synthetic-invalid');
      expect(await prisma.inviteCode.count()).toBe(before);
    },
  );

  it.each([Role.PARENT, Role.PROFESSOR])(
    'returns 403 for current %s and for an ADMIN demoted after login',
    async (role) => {
      const fixture = await account(`role-${role}`, role);
      const before = await prisma.inviteCode.count();
      await request(app.getHttpServer())
        .post('/api/v1/invite-codes')
        .auth(fixture.token, { type: 'bearer' })
        .send({ role: 'PROFESSOR' })
        .expect(403);
      expect(await prisma.inviteCode.count()).toBe(before);

      const admin = await account(`demoted-${role}`, Role.ADMIN);
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: Role.PARENT },
      });
      await request(app.getHttpServer())
        .post('/api/v1/invite-codes')
        .auth(admin.token, { type: 'bearer' })
        .send({ role: 'PROFESSOR' })
        .expect(403);
      expect(await prisma.inviteCode.count()).toBe(before);
    },
  );

  it.each([
    ['missing role', {}],
    ['ADMIN role', { role: 'ADMIN' }],
    ['PARENT role', { role: 'PARENT' }],
    ['number role', { role: 1 }],
    ['extra lifetime', { role: 'PROFESSOR', expiresInDays: 7 }],
    ['extra code', { role: 'PROFESSOR', code: 'SYNTHETIC_SECRET' }],
  ])('rejects %s issuance bodies before writing', async (_label, body) => {
    const admin = await account(`bad-body-${_label}`, Role.ADMIN);
    const response = await request(app.getHttpServer())
      .post('/api/v1/invite-codes')
      .auth(admin.token, { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(JSON.stringify(response.body)).not.toContain('SYNTHETIC_SECRET');
    expect(await prisma.inviteCode.count()).toBe(0);
  });

  it('keeps PARENT and legacy PROFESSOR registration, rejects historical ADMIN, and maps email conflicts', async () => {
    const parent = await register(email('parent')).expect(201);
    expect(parent.headers['cache-control']).toBe('no-store');
    expect((parent.body as AuthResponse).role).toBe(Role.PARENT);

    const oldProfessorCode = code('legacy-professor');
    const oldAdminCode = code('historical-admin');
    await makeInvite(oldProfessorCode, Role.PROFESSOR);
    await makeInvite(oldAdminCode, Role.ADMIN);
    const professor = await register(
      email('legacy-professor'),
      oldProfessorCode,
    ).expect(201);
    expect((professor.body as AuthResponse).role).toBe(Role.PROFESSOR);
    const adminFailure = await register(
      email('historical-admin'),
      oldAdminCode,
    ).expect(400);
    expect(adminFailure.body.message).toBe(
      'Código de convite inválido ou indisponível.',
    );
    expect(
      await prisma.inviteCode.findUniqueOrThrow({
        where: { code: oldAdminCode },
      }),
    ).toMatchObject({ isActive: true });

    const duplicateCode = code('email-conflict');
    await makeInvite(duplicateCode);
    await register(email('duplicate')).expect(201);
    const conflict = await register(email('duplicate'), duplicateCode).expect(
      409,
    );
    expect(conflict.headers['cache-control']).toBe('no-store');
    expect(
      await prisma.inviteCode.findUniqueOrThrow({
        where: { code: duplicateCode },
      }),
    ).toMatchObject({ isActive: true });
  });

  it('uses one generic, no-store registration error for every unavailable invite state', async () => {
    const adminCode = code('generic-admin');
    const inactiveCode = code('generic-inactive');
    const expiredCode = code('generic-expired');
    const usedCode = code('generic-used');
    await makeInvite(adminCode, Role.ADMIN);
    await makeInvite(inactiveCode, Role.PROFESSOR, undefined, false);
    await makeInvite(expiredCode, Role.PROFESSOR, new Date(Date.now() - 1000));
    await makeInvite(usedCode, Role.PROFESSOR, undefined, false);

    const responses = await Promise.all([
      register(email('generic-unknown'), code('never-created')),
      register(email('generic-admin'), adminCode),
      register(email('generic-inactive'), inactiveCode),
      register(email('generic-expired'), expiredCode),
      register(email('generic-used'), usedCode),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      400, 400, 400, 400, 400,
    ]);
    expect(
      responses.map(
        (response) => (response.body as { message: string }).message,
      ),
    ).toEqual(Array(5).fill('Código de convite inválido ou indisponível.'));
    for (const response of responses) {
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(
      await prisma.inviteCode.findMany({
        where: {
          code: { in: [adminCode, inactiveCode, expiredCode, usedCode] },
        },
        select: { isActive: true },
        orderBy: { code: 'asc' },
      }),
    ).toEqual([
      { isActive: true },
      { isActive: true },
      { isActive: false },
      { isActive: false },
    ]);
  });
});
