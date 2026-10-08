import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthSessionService } from './auth-session.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

describe('AuthSessionService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    user: { findUnique: jest.fn() },
    authSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    authSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: AuthSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSessionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AuthSessionService>(AuthSessionService);
    jest.resetAllMocks();
    tx.user.findUnique.mockResolvedValue({ id: 'user-id' });
    prisma.$transaction.mockImplementation(
      (operation: (client: typeof tx) => unknown) =>
        Promise.resolve(operation(tx)),
    );
  });

  it('hashes refresh tokens when creating a session', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    tx.user.findUnique.mockResolvedValue({ id: 'user-id' });
    tx.authSession.create.mockResolvedValue({ id: 'sid' });

    await service.create('user-id', 'sid', 'refresh', new Date('2026-09-01'));

    expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
    expect(tx.authSession.create).toHaveBeenCalledWith({
      data: {
        id: 'sid',
        userId: 'user-id',
        refreshTokenHash: 'hashed',
        expiresAt: new Date('2026-09-01'),
      },
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect((bcrypt.hash as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      prisma.$transaction.mock.invocationCallOrder[0],
    );
  });

  it('queries only active, unexpired sessions for the matching user and sid', async () => {
    prisma.authSession.findFirst.mockResolvedValue(null);
    const now = new Date('2026-09-01');

    await service.findActive('user-id', 'sid', now);

    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'sid',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  });

  it('locks the account row with a parameterized query before running work', async () => {
    const result = await service.withUserLock('account-id', () =>
      Promise.resolve('done'),
    );

    expect(result).toBe('done');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [query, accountId] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(query[0]).toContain('WHERE "id" = ');
    expect(query[1]).toContain('FOR UPDATE');
    expect(accountId).toBe('account-id');
  });

  it('checks sid ownership, revocation and expiry on the supplied transaction', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    tx.authSession.findFirst.mockResolvedValue({
      id: 'sid',
      userId: 'user-id',
    });

    const session = await service.findActiveInTransaction(
      tx as never,
      'user-id',
      'sid',
      now,
    );

    expect(session).toEqual(expect.objectContaining({ id: 'sid' }));
    expect(tx.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'sid',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
  });

  it('creates a session on the supplied transaction with a prepared refresh hash', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('prepared-refresh-hash');
    tx.authSession.create.mockResolvedValue({ id: 'sid' });
    const expiresAt = new Date('2026-09-08T00:00:00.000Z');
    const preparedHash =
      await service.prepareRefreshTokenHash('synthetic-refresh');

    await service.createInTransaction(
      tx as never,
      'user-id',
      'sid',
      preparedHash,
      expiresAt,
    );

    expect(tx.authSession.create).toHaveBeenCalledWith({
      data: {
        id: 'sid',
        userId: 'user-id',
        refreshTokenHash: 'prepared-refresh-hash',
        expiresAt,
      },
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('revokes every other active session', async () => {
    await service.revokeOthers('user-id', 'current-sid');
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', id: { not: 'current-sid' }, revokedAt: null },
      // Jest's asymmetric matcher is intentionally untyped.
      data: { revokedAt: expect.any(Date) as unknown as Date },
    });
  });

  it('revokes other sessions through the caller transaction and preserves the initiator', async () => {
    await service.revokeOthersInTransaction(
      tx as never,
      'user-id',
      'current-sid',
    );

    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', id: { not: 'current-sid' }, revokedAt: null },
      data: { revokedAt: expect.any(Date) as unknown as Date },
    });
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('does not clear a revoked timestamp while rotating a refresh token', async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      id: 'sid',
      userId: 'user-id',
      refreshTokenHash: 'snapshot',
    });
    tx.user.findUnique.mockResolvedValue({ id: 'user-id' });
    tx.authSession.findFirst.mockResolvedValue({
      id: 'sid',
      userId: 'user-id',
      refreshTokenHash: 'snapshot',
    });
    tx.authSession.updateMany.mockResolvedValue({ count: 1 });

    await service.rotate('sid', 'synthetic-refresh', new Date('2026-09-08'));

    const updateCalls = tx.authSession.updateMany.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    const [update] = updateCalls[0];
    expect(Object.prototype.hasOwnProperty.call(update.data, 'revokedAt')).toBe(
      false,
    );
  });

  it('fails closed if the User disappeared before session creation', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    await expect(
      service.create('gone', 'sid', 'refresh', new Date(Date.now() + 10000)),
    ).rejects.toThrow('Unauthorized');
    expect(tx.authSession.create).not.toHaveBeenCalled();
  });

  it.each([null, { refreshTokenHash: 'changed' }])(
    'rejects missing/rotated snapshots before rotation %#',
    async (live) => {
      prisma.authSession.findFirst.mockResolvedValue({
        id: 'sid',
        userId: 'user-id',
        refreshTokenHash: 'snapshot',
      });
      tx.user.findUnique.mockResolvedValue({ id: 'user-id' });
      tx.authSession.findFirst.mockResolvedValue(live);
      await expect(
        service.rotate('sid', 'refresh', new Date(Date.now() + 10000)),
      ).rejects.toThrow('Unauthorized');
      expect(tx.authSession.updateMany).not.toHaveBeenCalled();
      expect(prisma.authSession.update).not.toHaveBeenCalled();
    },
  );

  it('checks the digest representation before the legacy raw-token fallback', async () => {
    (bcrypt.compare as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await service.verifyRefreshToken(
      { refreshTokenHash: 'legacy-hash' },
      'synthetic-refresh',
    );

    expect(result).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledTimes(2);
  });

  it('rejects a mismatching refresh in both current and legacy representations', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.verifyRefreshToken(
        { refreshTokenHash: 'stored-hash' },
        'wrong-refresh',
      ),
    ).resolves.toBe(false);
  });

  it('fails closed when the conditional rotation loses its active-session snapshot', async () => {
    tx.authSession.findFirst.mockResolvedValue({
      refreshTokenHash: 'snapshot',
    });
    tx.authSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.rotateInTransaction(
        tx as never,
        'user-id',
        'sid',
        'snapshot',
        'replacement',
        new Date(Date.now() + 10000),
      ),
    ).rejects.toThrow('Unauthorized');
  });
});
