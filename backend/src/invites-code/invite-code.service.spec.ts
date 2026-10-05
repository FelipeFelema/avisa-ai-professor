/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import {
  ForbiddenException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { InviteCodeService } from './invite-code.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InviteCodeService', () => {
  const prisma = { $transaction: jest.fn() };
  let service: InviteCodeService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new InviteCodeService(prisma as unknown as PrismaService);
  });

  const createAuthTx = (role: Role = Role.ADMIN, sessionId = 'sid') => ({
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-id' }]),
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-id', role }) },
    authSession: {
      findUnique: jest.fn().mockResolvedValue({
        id: sessionId,
        userId: 'user-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
    inviteCode: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'invite-id',
          ...data,
          isActive: true,
          updatedAt: data.createdAt,
        }),
      ),
    },
  });

  it('revalidates current ADMIN and owned active session, then emits fixed seven-day PROFESSOR code', async () => {
    const tx = createAuthTx();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const created = await service.createInviteCode('user-id', 'sid');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: { id: true, role: true },
    });
    expect(tx.authSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'sid' },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });
    expect(created.role).toBe(Role.PROFESSOR);
    expect(created.code).toMatch(/^PROF-[A-F0-9]{32}$/);
    expect(created.isActive).toBe(true);
    expect(created.expiresAt.getTime() - created.createdAt.getTime()).toBe(
      604800000,
    );
  });

  it('rejects absent sessions with sanitized 401 and inserts nothing', async () => {
    const tx = createAuthTx();
    tx.authSession.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    await expect(
      service.createInviteCode('user-id', 'missing'),
    ).rejects.toThrow(UnauthorizedException);
    expect(tx.inviteCode.create).not.toHaveBeenCalled();
  });

  it('rejects changed non-ADMIN role with 403 and inserts nothing', async () => {
    const tx = createAuthTx(Role.PARENT);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    await expect(service.createInviteCode('user-id', 'sid')).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.inviteCode.create).not.toHaveBeenCalled();
  });

  it('uses at most three fresh transactions for code collisions and sanitizes exhaustion', async () => {
    const secret = 'collision-code-sentinel';
    const collision = Object.assign(new Error(secret), {
      code: 'P2002',
      meta: { target: ['code'] },
    });
    const txs = Array.from({ length: 3 }, () => createAuthTx());
    txs.forEach((tx) => tx.inviteCode.create.mockRejectedValue(collision));
    let index = 0;
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(txs[index++]),
    );
    let caught: unknown;
    try {
      await service.createInviteCode('user-id', 'sid');
    } catch (error) {
      caught = error;
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(caught)).not.toContain(secret);
  });

  it('sanitizes driver adapter collision metadata and non-collision failures', async () => {
    const sentinel = 'SYNTHETIC_INVITE_DRIVER_PAYLOAD';
    const collision = Object.assign(new Error(sentinel), {
      code: 'P2002',
      meta: {
        modelName: 'InviteCode',
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            originalMessage: `Unique constraint InviteCode_code_key ${sentinel}`,
          },
        },
      },
    });
    const txs = Array.from({ length: 3 }, () => createAuthTx());
    txs.forEach((tx) => tx.inviteCode.create.mockRejectedValue(collision));
    let index = 0;
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(txs[index++]),
    );

    let caught: unknown;
    try {
      await service.createInviteCode('user-id', 'sid');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify(caught)).not.toContain(sentinel);
    expect((caught as Error).message).not.toContain(sentinel);

    const failed = createAuthTx();
    failed.inviteCode.create.mockRejectedValue(
      Object.assign(new Error(sentinel), {
        code: 'P2002',
        meta: { target: ['email'] },
        cause: { driver: sentinel },
      }),
    );
    prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(failed),
    );
    caught = undefined;
    try {
      await service.createInviteCode('user-id', 'sid');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify(caught)).not.toContain(sentinel);
    expect((caught as Error).message).not.toContain(sentinel);
  });

  it('consumes only active unexpired PROFESSOR invite on caller transaction', async () => {
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'invite-id',
            role: Role.PROFESSOR,
            isActive: true,
            expiresAt: new Date(Date.now() + 60000),
          },
        ])
        .mockResolvedValueOnce([{ id: 'invite-id' }]),
    };
    await expect(
      service.consumeInviteCode(tx as never, 'old-prof-code'),
    ).resolves.toBe(Role.PROFESSOR);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    const consumeSql = tx.$queryRaw.mock.calls[1]?.[0]?.join('');
    expect(consumeSql).toContain("clock_timestamp() AT TIME ZONE 'UTC'");
    expect(consumeSql).toContain('expiresAt" > consumption."instant');
    expect(consumeSql).toContain('updatedAt" = consumption."instant');
  });

  it('uses the same generic unavailable error for absent and ADMIN codes', async () => {
    for (const row of [
      null,
      {
        id: 'admin-id',
        role: Role.ADMIN,
        isActive: true,
        expiresAt: new Date(Date.now() + 60000),
      },
    ]) {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue(row ? [row] : []),
        $executeRaw: jest.fn(),
        inviteCode: { updateMany: jest.fn() },
      };
      await expect(
        service.consumeInviteCode(tx as never, 'sentinel'),
      ).rejects.toMatchObject({
        response: { message: 'Código de convite inválido ou indisponível.' },
      });
      expect(tx.inviteCode.updateMany).not.toHaveBeenCalled();
    }
  });

  it.each([
    [
      'inactive',
      {
        id: 'id',
        role: Role.PROFESSOR,
        isActive: false,
        expiresAt: new Date(Date.now() + 60000),
      },
    ],
    [
      'expired at equality',
      {
        id: 'id',
        role: Role.PROFESSOR,
        isActive: true,
        expiresAt: new Date('2026-10-04T12:00:00.000Z'),
      },
    ],
    [
      'used',
      {
        id: 'id',
        role: Role.PROFESSOR,
        isActive: false,
        expiresAt: new Date(Date.now() + 60000),
      },
    ],
    [
      'historical ADMIN',
      {
        id: 'id',
        role: Role.ADMIN,
        isActive: true,
        expiresAt: new Date(Date.now() + 60000),
      },
    ],
  ])('rejects %s without changing the record', async (_label, invite) => {
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([invite])
        .mockResolvedValueOnce([]),
    };
    await expect(
      service.consumeInviteCode(tx as never, 'synthetic-code'),
    ).rejects.toMatchObject({
      response: { message: 'Código de convite inválido ou indisponível.' },
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(
      invite.isActive && invite.role === Role.PROFESSOR ? 2 : 1,
    );
  });
});
