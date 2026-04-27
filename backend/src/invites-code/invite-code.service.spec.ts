import { Test, TestingModule } from '@nestjs/testing';
import { InviteCodeService } from './invite-code.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

type InviteCodeMockResult = {
  id: string;
  code: string;
  role: Role;
  expiresAt: Date;
  isActive: boolean;
};

const mockPrisma = {
  inviteCode: {
    create: jest.fn<
      Promise<InviteCodeMockResult>,
      [Prisma.InviteCodeCreateArgs]
    >(),
    findUnique: jest.fn<
      Promise<InviteCodeMockResult | null>,
      [Prisma.InviteCodeFindUniqueArgs]
    >(),
    updateMany: jest.fn<
      Promise<{ count: number }>,
      [Prisma.InviteCodeUpdateManyArgs]
    >(),
  },
};

describe('InviteCodeService', () => {
  let service: InviteCodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteCodeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InviteCodeService>(InviteCodeService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createInviteCode', () => {
    it('should create a PROFESSOR invite code successfully', async () => {
      const mockResult: InviteCodeMockResult = {
        id: 'invite-id',
        code: 'PROF-4FZZZX',
        role: Role.PROFESSOR,
        expiresAt: new Date(),
        isActive: true,
      };

      mockPrisma.inviteCode.create.mockResolvedValue(mockResult);

      await service.createInviteCode(Role.PROFESSOR, 7);

      expect(mockPrisma.inviteCode.create).toHaveBeenCalledTimes(1);

      const createArgs = mockPrisma.inviteCode.create.mock.calls[0]?.[0];

      expect(createArgs).toBeDefined();
      expect(createArgs?.data.code).toMatch(/^PROF-/);
      expect(createArgs?.data.role).toBe(Role.PROFESSOR);
      expect(createArgs?.data.expiresAt).toBeInstanceOf(Date);
    });

    it('should create an ADMIN invite code successfully', async () => {
      const mockResult: InviteCodeMockResult = {
        id: 'invite-id',
        code: 'ADMIN-ABC123',
        role: Role.ADMIN,
        expiresAt: new Date(),
        isActive: true,
      };

      mockPrisma.inviteCode.create.mockResolvedValue(mockResult);

      await service.createInviteCode(Role.ADMIN, 3);

      expect(mockPrisma.inviteCode.create).toHaveBeenCalledTimes(1);

      const createArgs = mockPrisma.inviteCode.create.mock.calls[0]?.[0];

      expect(createArgs).toBeDefined();
      expect(createArgs?.data.code).toMatch(/^ADMIN-/);
      expect(createArgs?.data.role).toBe(Role.ADMIN);
      expect(createArgs?.data.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('validateInviteCode', () => {
    it('should return role when invite code is valid', async () => {
      const mockResult: InviteCodeMockResult = {
        id: 'invite-id',
        code: 'PROF-AAA',
        role: Role.PROFESSOR,
        isActive: true,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };

      mockPrisma.inviteCode.findUnique.mockResolvedValue(mockResult);
      mockPrisma.inviteCode.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.validateInviteCode('PROF-AAA');

      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledTimes(1);

      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'PROF-AAA' },
        }),
      );

      expect(mockPrisma.inviteCode.updateMany).toHaveBeenCalledTimes(1);

      const updateManyArgs =
        mockPrisma.inviteCode.updateMany.mock.calls[0]?.[0];

      expect(updateManyArgs).toMatchObject({
        where: {
          id: 'invite-id',
          isActive: true,
        },
        data: { isActive: false },
      });

      const expiresAtFilter = updateManyArgs?.where?.expiresAt;

      expect(
        typeof expiresAtFilter === 'object' &&
          expiresAtFilter !== null &&
          'gte' in expiresAtFilter &&
          expiresAtFilter.gte instanceof Date,
      ).toBe(true);

      expect(result).toBe(Role.PROFESSOR);
    });

    it('should throw BadRequestException when invite code does not exist', async () => {
      mockPrisma.inviteCode.findUnique.mockResolvedValue(null);

      await expect(service.validateInviteCode('INVALID-CODE')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'INVALID-CODE' },
      });
    });

    it('should throw BadRequestException when invite code is inactive', async () => {
      const mockResult: InviteCodeMockResult = {
        id: 'invite-id',
        code: 'PROF-AAA',
        role: Role.PROFESSOR,
        isActive: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };

      mockPrisma.inviteCode.findUnique.mockResolvedValue(mockResult);

      await expect(service.validateInviteCode('PROF-AAA')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'PROF-AAA' },
      });
    });

    it('should throw BadRequestException when invite code is expired', async () => {
      const mockResult: InviteCodeMockResult = {
        id: 'invite-id',
        code: 'PROF-AAA',
        role: Role.PROFESSOR,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
      };

      mockPrisma.inviteCode.findUnique.mockResolvedValue(mockResult);

      await expect(service.validateInviteCode('PROF-AAA')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.inviteCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'PROF-AAA' },
      });
    });

    it('should throw BadRequestException when invite code cannot be consumed', async () => {
      const mockResult: InviteCodeMockResult = {
        id: 'invite-id',
        code: 'PROF-AAA',
        role: Role.PROFESSOR,
        isActive: true,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };

      mockPrisma.inviteCode.findUnique.mockResolvedValue(mockResult);
      mockPrisma.inviteCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.validateInviteCode('PROF-AAA')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.inviteCode.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
