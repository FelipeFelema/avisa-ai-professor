import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.announcement.findMany({
      where: {
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        expiresAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        expiresAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!announcement) {
      throw new NotFoundException('Comunicado não encontrado');
    }

    return announcement;
  }

  async create(userId: string, dto: CreateAnnouncementDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.durationInDays);

    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        expiresAt,
        authorId: userId,
        classroomId: dto.classroomId,
      },
    });
  }
}
