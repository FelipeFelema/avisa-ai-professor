import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAnnouncementDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.durationInDays);

    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        expiresAt,
        authorId: userId,
      },
    });
  }
}
