import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomBytes } from 'crypto';
import {
  InviteCodeRole,
  isInviteCodeRole,
} from './types/invite-code-role.types';

@Injectable()
export class InviteCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async createInviteCode(role: InviteCodeRole, expiresInDays: number) {
    const code = this.generateCode(role);

    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );

    return this.prisma.inviteCode.create({
      data: {
        code,
        role,
        expiresAt,
      },
    });
  }

  private generateCode(role: InviteCodeRole): string {
    const prefix = role === Role.PROFESSOR ? 'PROF' : 'ADMIN';

    const random = randomBytes(3).toString('hex').toUpperCase();

    return `${prefix}-${random}`;
  }

  async validateInviteCode(code: string): Promise<InviteCodeRole> {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code },
    });

    if (!invite) {
      throw new BadRequestException('Código de convite inválido');
    }

    if (!isInviteCodeRole(invite.role)) {
      throw new BadRequestException('Código de convite inválido');
    }

    if (!invite.isActive) {
      throw new BadRequestException('Código de convite inativo');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Código de convite expirado');
    }

    const result = await this.prisma.inviteCode.updateMany({
      where: {
        id: invite.id,
        isActive: true,
        expiresAt: { gte: new Date() },
      },
      data: {
        isActive: false,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'Código de convite inválido ou já utilizado',
      );
    }

    return invite.role;
  }
}
