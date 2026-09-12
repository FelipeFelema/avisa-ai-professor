import { Test, TestingModule } from '@nestjs/testing';
import { ClassroomsService } from './classrooms.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CLASSROOMS_LIMITS } from '../common/constants/classroom.constants';

const mockPrisma = {
  $transaction: jest.fn(),
  classroom: {
    create: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  userClassroom: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  classroomDeletionReceipt: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe('ClassroomsService', () => {
  let service: ClassroomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassroomsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ClassroomsService>(ClassroomsService);

    jest.clearAllMocks();

    mockPrisma.classroom.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
    );
  });

  describe('create', () => {
    it('should create a classroom and add user using an uppercase name', async () => {
      const userId = 'user-id';
      const name = '1° ano A';

      const mockClassroom = {
        id: 'classroom-id',
        name: '1° ANO A',
        userClassrooms: [],
      };

      mockPrisma.classroom.findFirst.mockResolvedValue(null);
      mockPrisma.classroom.create.mockResolvedValue(mockClassroom);

      const result = await service.create(userId, name);

      expect(mockPrisma.classroom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: '1° ANO A',
            ownerId: userId,
            userClassrooms: {
              create: { userId },
            },
          },
        }),
      );

      expect(result).toEqual(mockClassroom);
    });

    it('should throw BadRequestException when classroom name already exists ignoring case', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create('user-id', '1° ano a')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when classroom limit is reached', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue(null);
      mockPrisma.classroom.count.mockResolvedValue(
        CLASSROOMS_LIMITS.MAX_CLASSROOMS,
      );

      await expect(service.create('user-id', '1° ano a')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('join', () => {
    it('should join classroom successfully', async () => {
      mockPrisma.classroom.findUnique.mockResolvedValue({ id: 'classroom-id' });

      mockPrisma.userClassroom.findUnique.mockResolvedValue(null);

      mockPrisma.userClassroom.create.mockResolvedValue({});

      const mockResult = { id: 'classroom-id', userClassrooms: [] };

      mockPrisma.classroom.findUniqueOrThrow.mockResolvedValue(mockResult);

      const result = await service.join('user-id', 'classroom-id');

      expect(mockPrisma.userClassroom.create).toHaveBeenCalledWith({
        data: { userId: 'user-id', classroomId: 'classroom-id' },
      });
      expect(mockPrisma.userClassroom.create).toHaveBeenCalledTimes(1);

      expect(mockPrisma.classroom.findUnique).toHaveBeenCalled();

      expect(mockPrisma.classroom.findUnique).toHaveBeenCalledWith({
        where: { id: 'classroom-id' },
      });

      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException if classroom does not exist', async () => {
      mockPrisma.classroom.findUnique.mockResolvedValue(null);

      await expect(service.join('user-id', 'classroom-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user already in classroom', async () => {
      mockPrisma.classroom.findUnique.mockResolvedValue({ id: 'classroom-id' });

      mockPrisma.userClassroom.findUnique.mockResolvedValue({
        userId: 'user-id',
        classroomId: 'classroom-id',
      });

      await expect(service.join('user-id', 'classroom-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('leave', () => {
    it('should leave classroom successfully', async () => {
      mockPrisma.userClassroom.findUnique.mockResolvedValue({
        userId: 'user-id',
        classroomId: 'classroom-id',
      });

      mockPrisma.userClassroom.delete.mockResolvedValue({});

      const mockResult = { id: 'classroom-id', userClassrooms: [] };

      mockPrisma.classroom.findUnique.mockResolvedValue(mockResult);

      const result = await service.leave('user-id', 'classroom-id');

      expect(mockPrisma.userClassroom.delete).toHaveBeenCalled();

      expect(mockPrisma.userClassroom.delete).toHaveBeenCalledWith({
        where: {
          userId_classroomId: {
            userId: 'user-id',
            classroomId: 'classroom-id',
          },
        },
      });

      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException if user is not in classroom', async () => {
      mockPrisma.userClassroom.findUnique.mockResolvedValue(null);

      await expect(service.leave('user-id', 'classroom-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block the classroom owner from leaving their own classroom', async () => {
      mockPrisma.userClassroom.findUnique.mockResolvedValue({
        userId: 'owner-id',
        classroomId: 'classroom-id',
      });
      mockPrisma.classroom.findUnique.mockResolvedValue({
        id: 'classroom-id',
        ownerId: 'owner-id',
      });

      await expect(service.leave('owner-id', 'classroom-id')).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrisma.userClassroom.delete).not.toHaveBeenCalled();
    });
  });

  describe('findMyClassrooms', () => {
    it('should return user classroms', async () => {
      const mockResult = [
        {
          id: 'classroom-1',
          name: '1° Ano A',
          ownerId: 'teacher-1',
          owner: {
            id: 'teacher-1',
            name: 'Professor Test',
          },
          userClassrooms: [
            {
              user: {
                id: 'teacher-1',
                name: 'Professor Test',
              },
            },
          ],
          announcements: [
            {
              id: 'announcement-1',
              title: 'Anúncio 1',
              createdAt: new Date(),
            },
          ],
        },
        {
          id: 'classroom-2',
          name: '1° Ano B',
          ownerId: 'teacher-2',
          owner: {
            id: 'teacher-2',
            name: 'Professor Test 2',
          },
          userClassrooms: [
            {
              user: {
                id: 'teacher-2',
                name: 'Professor Test 2',
              },
            },
          ],
          announcements: [],
        },
      ];

      mockPrisma.classroom.findMany.mockResolvedValue(mockResult);

      const result = await service.findMyClassrooms('user-id');

      expect(mockPrisma.classroom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userClassrooms: {
              some: { userId: 'user-id' },
            },
          },
        }),
      );

      expect(result).toEqual([
        {
          id: 'classroom-1',
          name: '1° Ano A',
          ownerId: 'teacher-1',
          teacher: {
            id: 'teacher-1',
            name: 'Professor Test',
          },
          lastAnnouncement: {
            id: 'announcement-1',
            title: 'Anúncio 1',
            createdAt: mockResult[0].announcements[0].createdAt,
          },
        },
        {
          id: 'classroom-2',
          name: '1° Ano B',
          ownerId: 'teacher-2',
          teacher: {
            id: 'teacher-2',
            name: 'Professor Test 2',
          },
          lastAnnouncement: null,
        },
      ]);
    });
  });

  describe('delete', () => {
    it('should delete classroom when user is the owner', async () => {
      const userId = 'user-id';
      const classroomId = 'classroom-id';

      mockPrisma.classroom.findUnique.mockResolvedValue({
        id: classroomId,
        ownerId: userId,
      });

      mockPrisma.classroom.delete.mockResolvedValue({
        id: classroomId,
      });

      await service.delete(userId, classroomId);

      expect(mockPrisma.classroom.findUnique).toHaveBeenCalledWith({
        where: {
          id: classroomId,
        },
      });

      expect(mockPrisma.classroom.delete).toHaveBeenCalledWith({
        where: {
          id: classroomId,
        },
      });

      expect(mockPrisma.classroom.delete).toHaveBeenCalledTimes(1);
    });

    it('should throw ForbiddenException when user is not the classroom owner', async () => {
      const userId = 'user-id';
      const classroomId = 'classroom-id';

      mockPrisma.classroom.findUnique.mockResolvedValue({
        id: classroomId,
        ownerId: 'another-user-id',
      });

      await expect(service.delete(userId, classroomId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockPrisma.classroom.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when classroom does not exist', async () => {
      const userId = 'user-id';
      const classroomId = 'classroom-id';

      mockPrisma.classroom.findUnique.mockResolvedValue(null);

      await expect(service.delete(userId, classroomId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.classroom.delete).not.toHaveBeenCalled();
    });

    it('should create a deletion receipt and delete atomically for the explicit owner', async () => {
      const userId = 'owner-id';
      const classroomId = 'classroom-id';

      mockPrisma.classroom.findUnique.mockResolvedValue({
        id: classroomId,
        ownerId: userId,
      });
      mockPrisma.classroomDeletionReceipt.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(
        async (
          callback: (transaction: typeof mockPrisma) => Promise<unknown>,
        ) => callback(mockPrisma),
      );

      await service.delete(userId, classroomId);

      expect(
        mockPrisma.classroomDeletionReceipt.findUnique,
      ).toHaveBeenCalledWith({ where: { classroomId } });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.classroomDeletionReceipt.create).toHaveBeenCalledWith({
        data: { classroomId, ownerId: userId },
      });
    });

    it('should resolve an absent classroom when its receipt belongs to the same owner', async () => {
      const userId = 'owner-id';
      const classroomId = 'classroom-id';

      mockPrisma.classroom.findUnique.mockResolvedValue(null);
      mockPrisma.classroomDeletionReceipt.findUnique.mockResolvedValue({
        classroomId,
        ownerId: userId,
      });

      await expect(
        service.delete(userId, classroomId),
      ).resolves.toBeUndefined();

      expect(mockPrisma.classroom.delete).not.toHaveBeenCalled();
    });

    it('should make concurrent same-owner deletes produce one effect and two successful results', async () => {
      const userId = 'owner-id';
      const classroomId = 'classroom-id';

      mockPrisma.classroom.findUnique
        .mockResolvedValueOnce({ id: classroomId, ownerId: userId })
        .mockResolvedValueOnce(null);
      mockPrisma.classroomDeletionReceipt.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ classroomId, ownerId: userId });
      mockPrisma.classroom.delete.mockResolvedValue({ id: classroomId });
      mockPrisma.$transaction.mockImplementation(
        async (
          callback: (transaction: typeof mockPrisma) => Promise<unknown>,
        ) => callback(mockPrisma),
      );

      await expect(
        Promise.all([
          service.delete(userId, classroomId),
          service.delete(userId, classroomId),
        ]),
      ).resolves.toEqual([undefined, undefined]);

      expect(mockPrisma.classroom.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.classroomDeletionReceipt.create).toHaveBeenCalledTimes(
        1,
      );
    });
  });
});
