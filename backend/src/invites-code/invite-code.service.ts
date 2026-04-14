import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InviteCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async createInviteCode(role: Role, expiresInDays: number) {
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

  private generateCode(role: Role): string {
    const prefix = role === Role.PROFESSOR ? 'PROF' : 'ADMIN';

    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    return `${prefix}-${random}`;
  }

  async validateInviteCode(code: string): Promise<Role> {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code },
    });

    if (!invite) {
      throw new BadRequestException('Código de convite inválido');
    }

    if (!invite.isActive) {
      throw new BadRequestException('Código de convite inativo');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Código de convite expirado');
    }

    return invite.role;
  }
}
