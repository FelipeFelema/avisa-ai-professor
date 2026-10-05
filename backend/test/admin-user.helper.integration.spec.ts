import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { App } from 'supertest/types';
import request from 'supertest';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';
import { createTestApp } from './helpers/test-app.helper';
import { createAdminUserAndLogin } from './helpers/admin-user.helper';

describe('test-only ADMIN provisioning helper', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const prefix = `admin-helper-${randomUUID()}`;
  const password = 'Synthetic admin helper password';

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    assertSafeTestDatabase();
    await prisma.authSession.deleteMany({
      where: { user: { email: { startsWith: prefix } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await app.close();
  });

  it('refuses an unsafe database before provisioning or cleanup writes', async () => {
    const original = process.env.DATABASE_URL;
    const write = jest.spyOn(prisma.user, 'create');
    const cleanup = jest.spyOn(prisma, '$transaction');
    process.env.DATABASE_URL = 'postgresql://test:test@remote.invalid/avisa_ai';

    try {
      await expect(
        createAdminUserAndLogin(app, prisma, {
          email: `${prefix}-unsafe@example.test`,
          password,
        }),
      ).rejects.toThrow(/Refusing destructive test cleanup/);
      await expect(clearTestDatabase(prisma)).rejects.toThrow(
        /Refusing destructive test cleanup/,
      );
      expect(write).not.toHaveBeenCalled();
      expect(cleanup).not.toHaveBeenCalled();
    } finally {
      process.env.DATABASE_URL = original;
      write.mockRestore();
      cleanup.mockRestore();
    }
  });

  it('uses a hashed Prisma-only fixture and logs in through HTTP as current ADMIN', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const auth = await createAdminUserAndLogin(app, prisma, {
        email: `${prefix}-valid@example.test`,
        password,
      });
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: auth.user.id },
      });

      expect(stored.role).toBe(Role.ADMIN);
      expect(stored.password).not.toBe(password);
      expect(stored.password).toMatch(/^\$scrypt\$/);
      expect(auth.accessToken).toEqual(expect.any(String));
      expect(auth.refreshToken).toEqual(expect.any(String));

      const profile = await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .expect(200);
      expect(profile.body).toMatchObject({
        id: auth.user.id,
        role: Role.ADMIN,
      });
      expect(
        await prisma.authSession.count({
          where: {
            userId: auth.user.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ).toBe(1);
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
