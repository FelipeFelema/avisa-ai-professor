import { Test, TestingModule } from '@nestjs/testing';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

const mockPrisma = {
  announcement: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  userClassroom: {
    findUnique: jest.fn(),
  },
};

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return announcements for user', async () => {
      const mockResult = [{ id: '1', title: 'Test' }];

      mockPrisma.announcement.findMany.mockResolvedValue(mockResult);

      const result = await service.findAll('user-id');

      expect(mockPrisma.announcement.findMany).toHaveBeenCalled();

      expect(result).toEqual(mockResult);
    });
  });

  describe('findOneById', () => {
    it('should return announcement', async () => {
      const mockAnnouncement = [{ id: '1', title: 'Test' }];

      mockPrisma.announcement.findFirst.mockResolvedValue(mockAnnouncement);

      const result = await service.findOneById('user-id', '1');

      expect(result).toEqual(mockAnnouncement);
    });

    it('should throw NotFoundException if announcement does not exist', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue(null);

      await expect(service.findOneById('user-id', '1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create announcement successfully', async () => {
      const dto = {
        title: 'Test',
        content: 'Content',
        durationInDays: 3,
        classroomId: 'c1',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'PROFESSOR',
      });

      mockPrisma.userClassroom.findUnique.mockResolvedValue({});

      const mockResult = { id: 'announcement-id' };

      mockPrisma.announcement.create.mockResolvedValue(mockResult);

      const result = await service.create('user-id', dto);

      expect(mockPrisma.announcement.create).toHaveBeenCalled();

      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const dto = {
        title: 'Test',
        content: 'Content',
        durationInDays: 3,
        classroomId: 'c1',
      };

      await expect(service.create('user-id', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not a professor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'PARENT',
      });

      const dto = {
        title: 'Test',
        content: 'Content',
        durationInDays: 3,
        classroomId: 'c1',
      };

      await expect(service.create('user-id', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is not in classroom', async () => {
      const dto = {
        title: 'Test',
        content: 'Content',
        durationInDays: 3,
        classroomId: 'c1',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'PROFESSOR',
      });

      mockPrisma.userClassroom.findUnique.mockResolvedValue(null);

      await expect(service.create('userid', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update announcement successfully', async () => {
      const dto = {
        title: 'Updated',
        content: 'Updated',
        durationInDays: 3,
        classroomId: 'c1',
      };

      mockPrisma.announcement.findFirst.mockResolvedValue({
        id: 'id',
        expiresAt: new Date(Date.now() + 100000),
      });

      const mockResult = { id: 'id' };

      mockPrisma.announcement.update.mockResolvedValue(mockResult);

      const result = await service.update('user-id', 'id', dto);

      expect(mockPrisma.announcement.update).toHaveBeenCalled();

      expect(result).toEqual(mockResult);
    });

    it('should throw NotFoundException if announcement not found', async () => {
      const dto = {
        title: 'Updated',
        content: 'Updated',
        durationInDays: 3,
        classroomId: 'c1',
      };

      mockPrisma.announcement.findFirst.mockResolvedValue(null);

      await expect(service.update('user-id', 'id', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if announcement is expired', async () => {
      const dto = {
        title: 'Updated',
        content: 'Updated',
        durationInDays: 3,
        classroomId: 'c1',
      };

      mockPrisma.announcement.findFirst.mockResolvedValue({
        id: 'id',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.update('user-id', 'id', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should delete announcement successfully', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue({
        id: 'id',
      });

      mockPrisma.announcement.delete.mockResolvedValue({});

      await service.delete('user-id', 'id');

      expect(mockPrisma.announcement.delete).toHaveBeenCalledWith({
        where: { id: 'id' },
      });
    });

    it('should throw NotFoundException if announcement not found', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValue(null);

      await expect(service.delete('user-id', 'id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
