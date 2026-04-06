import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma, Role, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private userSelect: Prisma.UserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
    updatedAt: true,
  };

  async findByIdInternal(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(createUserDto: CreateUserDto) {
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      const user = await this.prisma.user.create({
        data: {
          ...createUserDto,
          password: hashedPassword,
          role: Role.PARENT,
        },
        select: this.userSelect,
      });

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Esse email já existe');
      }

      throw error;
    }
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
    refreshTokenId?: string,
  ): Promise<void> {
    const data: Prisma.UserUpdateInput = {};

    if (refreshToken) {
      data.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      data.refreshTokenId = refreshTokenId ?? null;
    } else {
      data.refreshTokenHash = null;
      data.refreshTokenId = null;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
