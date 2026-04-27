import { Test, TestingModule } from '@nestjs/testing';
import { ClassroomsService } from './classrooms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  classroom: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
  },
  userClassroom: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
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
  });

  describe('create', () => {
    it('should create a classroom and add user', async () => {
      const userId = 'user-id';
      const name = 'Classroom A';

      const mockClassroom = {
        id: 'classroom-id',
        name,
        userClassrooms: [],
      };

      mockPrisma.classroom.create.mockResolvedValue(mockClassroom);

      const result = await service.create(userId, name);

      expect(mockPrisma.classroom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name,
            userClassrooms: {
              create: { userId },
            },
          },
        }),
      );

      expect(result).toEqual(mockClassroom);
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
  });

  describe('findMyClassrooms', () => {
    it('should return user classroms', async () => {
      const mockResult = [{ id: 'classroom-1' }, { id: 'classroom-2' }];

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

      expect(result).toEqual(mockResult);
    });
  });
});
