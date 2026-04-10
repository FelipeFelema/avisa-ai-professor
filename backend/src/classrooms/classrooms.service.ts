import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassroomWithUsers } from 'src/common/types/classroom-with-users.type';

@Injectable()
export class ClassroomsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, name: string): Promise<ClassroomWithUsers> {
    return this.prisma.classroom.create({
      data: {
        name,
        userClassrooms: {
          create: { userId },
        },
      },
      include: {
        userClassrooms: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async join(userId: string, classroomId: string): Promise<ClassroomWithUsers> {
    const classroomExists = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
    });

    if (!classroomExists) {
      throw new NotFoundException('Turma não encontrada');
    }

    const existingMembership = await this.prisma.userClassroom.findUnique({
      where: {
        userId_classroomId: { userId, classroomId },
      },
    });

    if (existingMembership) {
      throw new BadRequestException('Usuário já está na turma');
    }

    await this.prisma.userClassroom.create({
      data: { userId, classroomId },
    });

    return this.prisma.classroom.findUniqueOrThrow({
      where: { id: classroomId },
      include: {
        userClassrooms: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }) as Promise<ClassroomWithUsers>;
  }

  async leave(
    userId: string,
    classroomId: string,
  ): Promise<ClassroomWithUsers> {
    const existingMembership = await this.prisma.userClassroom.findUnique({
      where: {
        userId_classroomId: { userId, classroomId },
      },
    });

    if (!existingMembership) {
      throw new BadRequestException('Usuário não está na turma');
    }

    await this.prisma.userClassroom.delete({
      where: {
        userId_classroomId: { userId, classroomId },
      },
    });

    return this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        userClassrooms: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }) as Promise<ClassroomWithUsers>;
  }

  async findMyClassrooms(userId: string): Promise<ClassroomWithUsers[]> {
    return this.prisma.classroom.findMany({
      where: {
        userClassrooms: {
          some: { userId },
        },
      },
      include: {
        userClassrooms: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }
}
