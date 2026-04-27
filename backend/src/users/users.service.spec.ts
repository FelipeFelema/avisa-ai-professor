import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { InviteCodeService } from 'src/invites-code/invite-code.service';
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

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      mockPrisma.user.create.mockRejectedValue({
        code: 'P2002',
      });

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should assign TEACHER role when invite code is valid', async () => {
      const createUserDto = {
        name: 'Teacher User',
        email: 'teacher@example.com',
        password: 'password123',
        teacherCode: 'valid-code',
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      mockInviteCodeService.validateInviteCode.mockResolvedValue('TEACHER');
      mockPrisma.user.create.mockResolvedValue({
        id: 'teacher-id',
        name: createUserDto.name,
        email: createUserDto.email,
        role: 'TEACHER',
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
            role: 'TEACHER',
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'teacher-id',
          name: createUserDto.name,
          email: createUserDto.email,
          role: 'TEACHER',
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

      mockInviteCodeService.validateInviteCode.mockRejectedValue(
        new BadRequestException('Código de convite inválido'),
      );

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('updateRefreshToken', () => {
    it('should hash and store refresh token', async () => {
      const userId = 'user-id';
      const refreshToken = 'refresh-token';
      const refreshTokenId = 'refresh-token-id';

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');

      await service.updateRefreshToken(userId, refreshToken, refreshTokenId);

      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      expect(bcrypt.hash).toHaveBeenCalledWith(refreshToken, 10);
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          refreshTokenHash: 'hashedRefreshToken',
          refreshTokenId: 'refresh-token-id',
        },
      });
    });

    it('should clear refresh token when null is provided', async () => {
      const userId = 'user-id';

      await service.updateRefreshToken(userId, null);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          refreshTokenHash: null,
          refreshTokenId: null,
        },
      });
    });
  });
});
