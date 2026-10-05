import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../common/security/password-hasher';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma, Role, User } from '@prisma/client';
import { InviteCodeService } from '../invites-code/invite-code.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  normalizeUserEmail,
  normalizeUserName,
  normalizeUserProfile,
} from '../common/normalizers/user-normalizer';

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
    const { teacherCode, ...userData } = createUserDto;
    try {
      const normalizedName = normalizeUserName(userData.name);
      const normalizedEmail = normalizeUserEmail(userData.email);
      const existingUser = await this.findByEmail(normalizedEmail);

      if (existingUser) {
        throw new ConflictException('Esse email já existe');
      }

      const hashedPassword = await hashPassword(userData.password);
      const data = {
        ...userData,
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
      };

      if (!teacherCode) {
        return await this.prisma.user.create({
          data: { ...data, role: Role.PARENT },
          select: this.userSelect,
        });
      }

      return await this.prisma.$transaction(async (tx) => {
        await this.inviteCodeService.consumeInviteCode(tx, teacherCode);
        return tx.user.create({
          data: { ...data, role: Role.PROFESSOR },
          select: this.userSelect,
        });
      });
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
        throw new ConflictException('Esse email já existe');
      }

      if (error instanceof HttpException) throw error;
      if (teacherCode)
        throw new InternalServerErrorException('Não foi possível cadastrar.');
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
    if (!this.profileChanges(currentUser, normalizedData).changed) {
      return currentUser;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
        `;

        const lockedUser = await tx.user.findUnique({
          where: { id: userId },
          select: this.userSelect,
        });
        if (!lockedUser) {
          throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado');
        }

        const activeSessions = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "AuthSession"
          WHERE "id" = ${currentSessionId}
            AND "userId" = ${userId}
            AND "revokedAt" IS NULL
            AND "expiresAt" > NOW()
          FOR UPDATE
        `;
        if (activeSessions.length === 0) {
          throw new UnauthorizedException('SessÃ£o invÃ¡lida');
        }

        const { data, emailChanged, changed } = this.profileChanges(
          lockedUser,
          normalizedData,
        );
        if (!changed) {
          return lockedUser;
        }

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

  private profileChanges(
    user: Pick<User, 'name' | 'email'>,
    normalizedData: ReturnType<typeof normalizeUserProfile>,
  ) {
    const data: Prisma.UserUpdateInput = {};
    const nameChanged =
      normalizedData.name !== undefined &&
      normalizedData.name !== normalizeUserName(user.name);
    const emailChanged =
      normalizedData.email !== undefined &&
      normalizedData.email !== normalizeUserEmail(user.email);

    if (nameChanged) {
      data.name = normalizedData.name;
    }
    if (emailChanged) {
      data.email = normalizedData.email;
    }

    return { data, emailChanged, changed: nameChanged || emailChanged };
  }
}
