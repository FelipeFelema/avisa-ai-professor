import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma, Role, User } from '@prisma/client';
import { InviteCodeService } from 'src/invites-code/invite-code.service';

function isPrismaError(error: unknown): error is { code: string } {
  return error !== null && typeof error === 'object' && 'code' in error;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inviteCodeService: InviteCodeService,
  ) {}

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
      const { teacherCode, ...userData } = createUserDto;

      const hashedPassword = await bcrypt.hash(userData.password, 10);

      let role: Role = Role.PARENT;

      if (teacherCode) {
        role = await this.inviteCodeService.validateInviteCode(teacherCode);
      }

      const user = await this.prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          role,
        },
        select: this.userSelect,
      });

      return user;
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
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
