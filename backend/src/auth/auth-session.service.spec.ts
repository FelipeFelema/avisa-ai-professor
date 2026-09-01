import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthSessionService } from './auth-session.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

describe('AuthSessionService', () => {
  const prisma = {
    authSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
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
    jest.clearAllMocks();
  });

  it('hashes refresh tokens when creating a session', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    prisma.authSession.create.mockResolvedValue({ id: 'sid' });

    await service.create('user-id', 'sid', 'refresh', new Date('2026-09-01'));

    expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: {
        id: 'sid',
        userId: 'user-id',
        refreshTokenHash: 'hashed',
        expiresAt: new Date('2026-09-01'),
      },
    });
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

  it('revokes every other active session', async () => {
    await service.revokeOthers('user-id', 'current-sid');
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', id: { not: 'current-sid' }, revokedAt: null },
      // Jest's asymmetric matcher is intentionally untyped.
      data: { revokedAt: expect.any(Date) as unknown as Date },
    });
  });
});
