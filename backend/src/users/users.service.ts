import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma, Role, User } from '@prisma/client';
import { InviteCodeService } from '../invites-code/invite-code.service';
import { UpdateUserDto } from './dto/update-user.dto';

const PASSWORD_SALT_ROUNDS = 10;

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

  async findByIdInternal(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    try {
      const { teacherCode, ...userData } = createUserDto;

      const normalizedEmail = userData.email.trim().toLowerCase();
      const existingUser = await this.findByEmail(normalizedEmail);

      if (existingUser) {
        throw new ConflictException('Esse email já existe');
      }

      const hashedPassword = await bcrypt.hash(
        userData.password,
        PASSWORD_SALT_ROUNDS,
      );

      let role: Role = Role.PARENT;

      if (teacherCode) {
        role = await this.inviteCodeService.validateInviteCode(teacherCode);
      }

      const user = await this.prisma.user.create({
        data: {
          ...userData,
          email: normalizedEmail,
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

  async getProfile(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect,
    });
  }

  async updateProfile(userId: string, updateData: UpdateUserDto) {
    try {
      const { password, email, ...profileData } = updateData;

      const data: Prisma.UserUpdateInput = { ...profileData };

      if (email) {
        data.email = email.trim().toLowerCase();
      }

      if (password) {
        data.password = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      }

      return await this.prisma.user.update({
        where: { id: userId },
        data,
        select: this.userSelect,
      });
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
        throw new ConflictException('Esse email já existe');
      }

      throw error;
    }
  }
}
