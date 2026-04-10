import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.announcement.findMany({
      where: {
        expiresAt: {
          gte: new Date(),
        },
        classroom: {
          userClassrooms: {
            some: {
              userId,
            },
          },
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

  async findOneById(userId: string, announcementId: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
        classroom: { userClassrooms: { some: { userId } } },
        expiresAt: {
          gte: new Date(),
        },
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

    if (!announcement) {
      throw new NotFoundException('Comunicado não encontrado');
    }

    return announcement;
  }

  async create(userId: string, dto: CreateAnnouncementDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.durationInDays);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (user.role !== 'PROFESSOR') {
      throw new ForbiddenException(
        'Apenas professores podem criar comunicados',
      );
    }

    const userClassroom = await this.prisma.userClassroom.findUnique({
      where: {
        userId_classroomId: {
          userId,
          classroomId: dto.classroomId,
        },
      },
    });

    if (!userClassroom) {
      throw new ForbiddenException('Usuário não pertence à turma');
    }

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

  async update(
    userId: string,
    announcementId: string,
    dto: CreateAnnouncementDto,
  ) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
        authorId: userId,
        classroom: { userClassrooms: { some: { userId } } },
      },
    });

    if (!announcement) {
      throw new NotFoundException('Comunicado não encontrado');
    }

    if (announcement.expiresAt < new Date()) {
      throw new BadRequestException('Comunicado expirado');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.durationInDays);

    return this.prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        title: dto.title,
        content: dto.content,
        expiresAt,
      },
    });
  }

  async delete(userId: string, announcementId: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
        authorId: userId,
        classroom: { userClassrooms: { some: { userId } } },
      },
    });

    if (!announcement) {
      throw new NotFoundException('Comunicado não encontrado');
    }

    await this.prisma.announcement.delete({
      where: { id: announcement.id },
    });

    return;
  }
}
