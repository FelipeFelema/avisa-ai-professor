import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteCodeService } from '../invites-code/invite-code.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockInviteCodeService = {
  validateInviteCode: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: InviteCodeService,
          useValue: mockInviteCodeService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('findByIdInternal', () => {
    it('should return user when id exists', async () => {
      const userId = 'user-id';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        role: 'PARENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findByIdInternal(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: userId,
          name: 'Test User',
          email: 'test@example.com',
          role: 'PARENT',
        }),
      );
    });

    it('should throw NotFoundException error when id does not exist', async () => {
      const userId = 'nonexistent-id';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByIdInternal(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      const email = 'test@example.com';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        name: 'Test User',
        email,
        role: 'PARENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findByEmail(email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-id',
          name: 'Test User',
          email,
          role: 'PARENT',
        }),
      );
    });

    it('should return null when email does not exist', async () => {
      const email = 'nonexistent@example.com';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail(email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const createUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        name: createUserDto.name,
        email: createUserDto.email,
        role: 'PARENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createUser(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: createUserDto.name,
            email: createUserDto.email,
            password: 'hashedPassword',
            role: 'PARENT',
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-id',
          name: createUserDto.name,
          email: createUserDto.email,
          role: 'PARENT',
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      const createUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: createUserDto.email,
      });

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException,
      );

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should assign PROFESSOR role when invite code is valid', async () => {
      const createUserDto = {
        name: 'Teacher User',
        email: 'teacher@example.com',
        password: 'password123',
        teacherCode: 'valid-code',
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockInviteCodeService.validateInviteCode.mockResolvedValue('PROFESSOR');
      mockPrisma.user.create.mockResolvedValue({
        id: 'teacher-id',
        name: createUserDto.name,
        email: createUserDto.email,
        role: 'PROFESSOR',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createUser(createUserDto);

      expect(mockInviteCodeService.validateInviteCode).toHaveBeenCalledTimes(1);
      expect(mockInviteCodeService.validateInviteCode).toHaveBeenCalledWith(
        createUserDto.teacherCode,
      );
      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: createUserDto.name,
            email: createUserDto.email,
            password: 'hashedPassword',
            role: 'PROFESSOR',
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'teacher-id',
          name: createUserDto.name,
          email: createUserDto.email,
          role: 'PROFESSOR',
        }),
      );
    });

    it('should throw BadRequestException when invite code is invalid', async () => {
      const createUserDto = {
        name: 'Teacher User',
        email: 'teacher@example.com',
        password: 'password123',
        teacherCode: 'invalid-code',
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockInviteCodeService.validateInviteCode.mockRejectedValue(
        new BadRequestException('Código de convite inválido'),
      );

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should not consume invite code when email already exists', async () => {
      const createUserDto = {
        name: 'Teacher User',
        email: 'teacher@example.com',
        password: 'password123',
        teacherCode: 'valid-code',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: createUserDto.email,
      });

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockInviteCodeService.validateInviteCode).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('updates a normalized name inside the transaction', async () => {
      const userId = 'user-id';
      const currentUser = {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        role: 'PARENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedUser = { ...currentUser, name: 'Updated User' };
      const tx = {
        user: { update: jest.fn().mockResolvedValue(updatedUser) },
        authSession: { updateMany: jest.fn() },
      };

      mockPrisma.user.findUnique.mockResolvedValue(currentUser);
      mockPrisma.$transaction.mockImplementation(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      );

      await expect(
        service.updateProfile(userId, 'session-id', { name: ' Updated User ' }),
      ).resolves.toEqual(updatedUser);

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Updated User' } }),
      );
      expect(tx.authSession.updateMany).not.toHaveBeenCalled();
    });
  });
});

type ProfileUpdateInput = {
  name?: string;
  email?: string;
  [key: string]: unknown;
};

type ProfileUpdateContract = {
  updateProfile(
    userId: string,
    currentSessionId: string,
    updateData: ProfileUpdateInput,
  ): Promise<unknown>;
};

describe('UsersService profile self-service contract', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InviteCodeService, useValue: mockInviteCodeService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.resetAllMocks();
  });

  const callUpdateProfile = (
    updateData: ProfileUpdateInput,
    userId = 'user-id',
    currentSessionId = 'current-session-id',
  ) =>
    (service as unknown as ProfileUpdateContract).updateProfile(
      userId,
      currentSessionId,
      updateData,
    );

  const createTransaction = (updatedUser: Record<string, unknown>) => {
    const tx = {
      user: { update: jest.fn().mockResolvedValue(updatedUser) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    mockPrisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    return tx;
  };

  const currentUser = {
    id: 'user-id',
    name: 'Nome Atual',
    email: 'atual@example.com',
    role: 'PARENT',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
  };

  it('trims the name, lowercases the email, and revokes only other sessions atomically', async () => {
    const updatedUser = {
      ...currentUser,
      name: 'Ana Maria',
      email: 'ana@example.com',
      updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    };
    mockPrisma.user.findUnique.mockResolvedValue(currentUser);
    const tx = createTransaction(updatedUser);

    await expect(
      callUpdateProfile({
        name: '  Ana Maria  ',
        email: '  ANA@EXAMPLE.COM  ',
      }),
    ).resolves.toEqual(updatedUser);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-id' },
        data: { name: 'Ana Maria', email: 'ana@example.com' },
      }),
    );
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        id: { not: 'current-session-id' },
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) as unknown as Date },
    });
  });

  it.each(['password', 'role', 'id', 'unknownField'])(
    'rejects forbidden profile field %s without writing',
    async (field) => {
      await expect(
        callUpdateProfile({
          [field]: field === 'password' ? 'new-password' : 'value',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('returns the current normalized profile without a write for a no-op', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(currentUser);

    await expect(
      callUpdateProfile({
        name: '  Nome Atual ',
        email: ' ATUAL@EXAMPLE.COM ',
      }),
    ).resolves.toEqual(currentUser);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(currentUser.updatedAt).toEqual(new Date('2026-09-01T10:00:00.000Z'));
  });

  it('maps a transactional P2002 to ConflictException and does not revoke sessions', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(currentUser);
    const tx = createTransaction(currentUser);
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.0.0' },
    );
    tx.user.update.mockRejectedValue(prismaError);

    await expect(
      callUpdateProfile({ email: 'existing@example.com' }),
    ).rejects.toThrow(ConflictException);

    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('does not revoke other sessions for a name-only update', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(currentUser);
    const tx = createTransaction({ ...currentUser, name: 'Novo Nome' });

    await callUpdateProfile({ name: 'Novo Nome' });

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Novo Nome' } }),
    );
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
  });
});
