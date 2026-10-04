import { Prisma, Role } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from '../common/security/password-hasher';

jest.mock('../common/security/password-hasher', () => ({
  verifyPassword: jest.fn(),
}));

describe('Account deletion impact', () => {
  const tx = {
    user: { findUnique: jest.fn(), count: jest.fn() },
    authSession: { findFirst: jest.fn() },
    classroom: { count: jest.fn() },
    announcement: { count: jest.fn() },
    userClassroom: { count: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (client: typeof tx) => unknown) => work(tx),
    );
    tx.authSession.findFirst.mockResolvedValue({ id: 'sid' });
    tx.user.count.mockResolvedValue(2);
    tx.classroom.count.mockResolvedValue(2);
    tx.announcement.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    tx.userClassroom.count.mockResolvedValue(1);
  });
  it.each(Object.values(Role))(
    'counts actual ownership and external relations for %s, including expired/third-party data',
    async (role) => {
      tx.user.findUnique.mockResolvedValue({
        role,
        password: 'must-not-leak',
        id: 'u',
      });
      expect(await service.getImpact('u', 'sid')).toEqual({
        role,
        canDelete: true,
        blockReason: null,
        ownedClassroomsCount: 2,
        announcementsInOwnedClassroomsCount: 3,
        externalMembershipsCount: 1,
        authoredAnnouncementsInOtherClassroomsCount: 1,
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
      expect(tx.announcement.count).toHaveBeenNthCalledWith(1, {
        where: { classroom: { ownerId: 'u' } },
      });
      expect(tx.announcement.count).toHaveBeenNthCalledWith(2, {
        where: { authorId: 'u', classroom: { ownerId: { not: 'u' } } },
      });
      expect(tx.userClassroom.count).toHaveBeenCalledWith({
        where: { userId: 'u', classroom: { ownerId: { not: 'u' } } },
      });
      expect(tx.authSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'sid',
          userId: 'u',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) as unknown as Date },
        },
        select: { id: true },
      });
    },
  );
  it('reports zero relations and last ADMIN without revealing total or identity', async () => {
    tx.user.findUnique.mockResolvedValue({ role: Role.ADMIN });
    tx.user.count.mockResolvedValue(1);
    tx.classroom.count.mockResolvedValue(0);
    tx.announcement.count.mockReset().mockResolvedValue(0);
    tx.userClassroom.count.mockResolvedValue(0);
    expect(await service.getImpact('u', 'sid')).toEqual({
      role: Role.ADMIN,
      canDelete: false,
      blockReason: 'LAST_ADMIN_REQUIRED',
      ownedClassroomsCount: 0,
      announcementsInOwnedClassroomsCount: 0,
      externalMembershipsCount: 0,
      authoredAnnouncementsInOtherClassroomsCount: 0,
    });
  });
  it.each(['user', 'sid'])(
    'rejects absent %s with no partial response',
    async (kind) => {
      tx.user.findUnique.mockResolvedValue(
        kind === 'user' ? null : { role: Role.PARENT },
      );
      tx.authSession.findFirst.mockResolvedValue(
        kind === 'sid' ? null : { id: 'sid' },
      );
      await expect(service.getImpact('u', 'sid')).rejects.toThrow(
        'Unauthorized',
      );
      expect(tx.classroom.count).not.toHaveBeenCalled();
    },
  );
  it('sanitizes SQL failures and does not retain a cause', async () => {
    prisma.$transaction.mockRejectedValue(new Error('SECRET_SQL_AND_HASH'));
    await expect(service.getImpact('u', 'sid')).rejects.toThrow(
      'Não foi possível consultar o impacto da exclusão.',
    );
  });
});

describe('Account deletion transaction', () => {
  const tx = {
    $queryRaw: jest.fn(),
    user: { findUnique: jest.fn(), count: jest.fn(), delete: jest.fn() },
    authSession: { findFirst: jest.fn(), deleteMany: jest.fn() },
    classroom: { findMany: jest.fn(), deleteMany: jest.fn() },
    announcement: { deleteMany: jest.fn() },
    userClassroom: { deleteMany: jest.fn() },
    classroomDeletionReceipt: { deleteMany: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
  );
  let rawSql: string[];
  const request = {
    currentPassword: '  existing password exactly  ',
    confirmationPhrase: 'EXCLUIR MINHA CONTA',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    rawSql = [];
    (verifyPassword as jest.Mock).mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      password: 'snapshot-hash',
      role: Role.PARENT,
    });
    prisma.$transaction.mockImplementation(
      (work: (client: typeof tx) => unknown) => work(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      rawSql.push(Array.from(strings).join(' '));
      return Promise.resolve([]);
    });
    tx.user.findUnique.mockResolvedValue({
      id: 'user-id',
      password: 'snapshot-hash',
      role: Role.PARENT,
    });
    tx.authSession.findFirst.mockResolvedValue({ id: 'session-id' });
    tx.user.count.mockResolvedValue(2);
    tx.classroom.findMany.mockResolvedValue([{ id: 'classroom-a' }]);
    tx.announcement.deleteMany.mockResolvedValue({ count: 2 });
    tx.userClassroom.deleteMany.mockResolvedValue({ count: 1 });
    tx.classroom.deleteMany.mockResolvedValue({ count: 1 });
    tx.classroomDeletionReceipt.deleteMany.mockResolvedValue({ count: 1 });
    tx.authSession.deleteMany.mockResolvedValue({ count: 2 });
    tx.user.delete.mockResolvedValue({ id: 'user-id' });
  });

  it('requires the exact phrase before reading credentials or opening a transaction', async () => {
    await expect(
      service.deleteOwnAccount('user-id', 'session-id', {
        ...request,
        confirmationPhrase: ' EXCLUIR MINHA CONTA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks the unchanged password snapshot outside locks and does not write on mismatch', async () => {
    (verifyPassword as jest.Mock).mockResolvedValue(false);
    await expect(
      service.deleteOwnAccount('user-id', 'session-id', request),
    ).rejects.toThrow('CURRENT_PASSWORD_INVALID');
    expect(verifyPassword).toHaveBeenCalledWith(
      request.currentPassword,
      'snapshot-hash',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses one READ COMMITTED transaction, gate before User, then removes the graph in order', async () => {
    await expect(
      service.deleteOwnAccount('user-id', 'session-id', request),
    ).resolves.toBeUndefined();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
    expect(
      (verifyPassword as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
    expect(rawSql[0]).toContain('pg_advisory_xact_lock');
    expect(rawSql[1]).toContain('FROM "User"');
    expect(rawSql[1]).toContain('FOR UPDATE');
    expect(rawSql[2]).toContain('FROM "Classroom"');
    expect(rawSql[2]).toContain('ORDER BY "id" ASC');
    expect(rawSql[2]).toContain('FOR UPDATE');
    expect(tx.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) as unknown as Date },
      },
      select: { id: true },
    });
    const writes = [
      tx.announcement.deleteMany,
      tx.userClassroom.deleteMany,
      tx.classroom.deleteMany,
      tx.classroomDeletionReceipt.deleteMany,
      tx.authSession.deleteMany,
      tx.user.delete,
    ];
    expect(writes.every((write) => write.mock.calls.length === 1)).toBe(true);
    expect(writes.map((write) => write.mock.invocationCallOrder[0])).toEqual(
      [...writes]
        .map((write) => write.mock.invocationCallOrder[0])
        .sort((a, b) => a - b),
    );
    expect(tx.announcement.deleteMany).toHaveBeenCalledWith({
      where: { authorId: 'user-id' },
    });
    expect(tx.classroom.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-id' },
    });
    expect(tx.classroomDeletionReceipt.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-id' },
    });
  });

  it.each([
    ['missing account', null, { id: 'session-id' }, UnauthorizedException],
    [
      'missing active session',
      { id: 'user-id', password: 'snapshot-hash', role: Role.PARENT },
      null,
      UnauthorizedException,
    ],
  ])(
    'fails closed for %s before writes',
    async (_label, user, session, error) => {
      tx.user.findUnique.mockResolvedValue(user);
      tx.authSession.findFirst.mockResolvedValue(session);
      await expect(
        service.deleteOwnAccount('user-id', 'session-id', request),
      ).rejects.toBeInstanceOf(error as new (...args: never[]) => Error);
      expect(tx.announcement.deleteMany).not.toHaveBeenCalled();
      expect(tx.user.delete).not.toHaveBeenCalled();
    },
  );

  it('rejects a changed credential snapshot before any write', async () => {
    tx.user.findUnique.mockResolvedValueOnce({
      id: 'user-id',
      password: 'new-hash',
      role: Role.PARENT,
    });
    await expect(
      service.deleteOwnAccount('user-id', 'session-id', request),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.announcement.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks the last live ADMIN after the gate and before writes', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: 'user-id',
      password: 'snapshot-hash',
      role: Role.ADMIN,
    });
    tx.user.count.mockResolvedValue(1);
    await expect(
      service.deleteOwnAccount('user-id', 'session-id', request),
    ).rejects.toThrow('LAST_ADMIN_REQUIRED');
    expect(tx.user.count).toHaveBeenCalledWith({ where: { role: Role.ADMIN } });
    expect(tx.classroom.findMany).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it('does not expose transaction failures or retry the destructive operation', async () => {
    prisma.$transaction.mockRejectedValue(new Error('SECRET_SQL_AND_HASH'));
    await expect(
      service.deleteOwnAccount('user-id', 'session-id', request),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    try {
      await service.deleteOwnAccount('user-id', 'session-id', request);
    } catch (error) {
      expect(String(error)).not.toContain('SECRET_SQL_AND_HASH');
      expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
    }
  });
});
