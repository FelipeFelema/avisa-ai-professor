import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClassroomsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    userId: string,
    name: string,
  ): Promise<
    Prisma.ClassroomGetPayload<{
      include: { users: { select: { id: true; name: true } } };
    }>
  > {
    return this.prisma.classroom.create({
      data: {
        name,
        users: {
          connect: { id: userId },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async join(
    userId: string,
    classroomId: string,
  ): Promise<Prisma.ClassroomGetPayload<{ include: { users: true } }>> {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        users: {
          where: {
            id: userId,
          },
          select: { id: true },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException('Turma não encontrada');
    }

    if (classroom.users.length > 0) {
      throw new BadRequestException('Usuário já está na turma');
    }

    return this.prisma.classroom.update({
      where: { id: classroomId },
      data: {
        users: {
          connect: { id: userId },
        },
      },
      include: {
        users: true,
      },
    });
  }

  async leave(
    userId: string,
    classroomId: string,
  ): Promise<Prisma.ClassroomGetPayload<{ include: { users: true } }>> {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        users: {
          where: {
            id: userId,
          },
          select: { id: true },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException('Turma não encontrada');
    }

    if (classroom.users.length === 0) {
      throw new BadRequestException('Usuário não está na turma');
    }

    return this.prisma.classroom.update({
      where: { id: classroomId },
      data: {
        users: {
          disconnect: { id: userId },
        },
      },
      include: {
        users: true,
      },
    });
  }

  async findMyClassrooms(userId: string): Promise<
    Prisma.ClassroomGetPayload<{
      include: { users: { select: { id: true; name: true } } };
    }>[]
  > {
    return this.prisma.classroom.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
