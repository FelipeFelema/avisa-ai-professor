import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma, Role, User } from '@prisma/client';
import { InviteCodeService } from '../invites-code/invite-code.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  normalizeUserEmail,
  normalizeUserName,
  normalizeUserProfile,
} from '../common/normalizers/user-normalizer';

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
      where: { email: normalizeUserEmail(email) },
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    try {
      const { teacherCode, ...userData } = createUserDto;

      const normalizedName = normalizeUserName(userData.name);
      const normalizedEmail = normalizeUserEmail(userData.email);
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
          name: normalizedName,
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

  async updateProfile(
    userId: string,
    currentSessionId: string,
    updateData: UpdateProfileDto,
  ) {
    const requestedFields = Object.keys(updateData as object);
    const unsupportedField = requestedFields.find(
      (field) => field !== 'name' && field !== 'email',
    );

    if (unsupportedField || requestedFields.length === 0) {
      throw new BadRequestException(
        'Atualize somente nome e/ou e-mail do seu perfil',
      );
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect,
    });

    if (!currentUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const normalizedData = normalizeUserProfile(updateData);
    const data: Prisma.UserUpdateInput = {};
    const nameChanged =
      normalizedData.name !== undefined &&
      normalizedData.name !== normalizeUserName(currentUser.name);
    const emailChanged =
      normalizedData.email !== undefined &&
      normalizedData.email !== normalizeUserEmail(currentUser.email);

    if (nameChanged) {
      data.name = normalizedData.name;
    }

    if (emailChanged) {
      data.email = normalizedData.email;
    }

    if (!nameChanged && !emailChanged) {
      return currentUser;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data,
          select: this.userSelect,
        });

        if (emailChanged) {
          await tx.authSession.updateMany({
            where: {
              userId,
              id: { not: currentSessionId },
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
        }

        return updatedUser;
      });
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
        throw new ConflictException('Esse email já existe');
      }

      throw error;
    }
  }
}
