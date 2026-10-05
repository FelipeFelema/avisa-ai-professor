import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { randomInviteCodeBytes } from './invite-code-random';

const INVITE_UNAVAILABLE = 'Código de convite inválido ou indisponível.';
const INVITE_TTL_MS = 604800000;

function codeUniqueCollision(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const candidate = error as {
    code?: unknown;
    meta?: Record<string, unknown> & { target?: unknown };
  };
  const target = candidate.meta?.target;
  const targets = Array.isArray(target)
    ? target.map((value) => String(value))
    : typeof target === 'string'
      ? [target]
      : [];
  const driver = candidate.meta?.driverAdapterError as
    | { cause?: Record<string, unknown> }
    | undefined;
  const cause = driver?.cause;
  const adapterCodeCollision =
    candidate.meta?.modelName === 'InviteCode' &&
    cause?.kind === 'UniqueConstraintViolation' &&
    typeof cause.originalMessage === 'string' &&
    cause.originalMessage.includes('InviteCode_code_key');
  return (
    candidate.code === 'P2002' &&
    (adapterCodeCollision ||
      targets.some(
        (value) =>
          value === 'code' || /(?:^|_)InviteCode_code_key$/.test(value),
      ))
  );
}

@Injectable()
export class InviteCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async createInviteCode(actorId: string, sessionId: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actorId} FOR UPDATE`;
          const user = await tx.user.findUnique({
            where: { id: actorId },
            select: { id: true, role: true },
          });
          if (!user) throw new UnauthorizedException();

          await tx.$queryRaw`SELECT "id" FROM "AuthSession" WHERE "id" = ${sessionId} AND "userId" = ${actorId} FOR UPDATE`;
          const session = await tx.authSession.findUnique({
            where: { id: sessionId },
            select: {
              id: true,
              userId: true,
              revokedAt: true,
              expiresAt: true,
            },
          });
          if (
            !session ||
            session.userId !== actorId ||
            session.revokedAt !== null ||
            session.expiresAt.getTime() <= Date.now()
          ) {
            throw new UnauthorizedException();
          }
          if (user.role !== Role.ADMIN) throw new ForbiddenException();

          const createdAt = new Date();
          const code = `PROF-${randomInviteCodeBytes(16).toString('hex').toUpperCase()}`;
          return tx.inviteCode.create({
            data: {
              code,
              role: Role.PROFESSOR,
              isActive: true,
              createdAt,
              updatedAt: createdAt,
              expiresAt: new Date(createdAt.getTime() + INVITE_TTL_MS),
            },
          });
        });
      } catch (error) {
        if (codeUniqueCollision(error)) {
          if (attempt < 2) continue;
          throw new ServiceUnavailableException(
            'Não foi possível gerar o convite. Tente novamente.',
          );
        }
        if (
          error instanceof UnauthorizedException ||
          error instanceof ForbiddenException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(
          'Não foi possível gerar o convite.',
        );
      }
    }
    throw new ServiceUnavailableException(
      'Não foi possível gerar o convite. Tente novamente.',
    );
  }

  async consumeInviteCode(
    tx: Prisma.TransactionClient,
    code: string,
  ): Promise<Role> {
    try {
      const rows = await tx.$queryRaw<
        Array<{ id: string; role: Role; isActive: boolean; expiresAt: Date }>
      >`SELECT "id", "role", "isActive", "expiresAt" FROM "InviteCode" WHERE "code" = ${code} FOR UPDATE`;
      const invite = rows[0];
      if (!invite || invite.role !== Role.PROFESSOR || !invite.isActive) {
        throw new BadRequestException(INVITE_UNAVAILABLE);
      }

      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        WITH consumption AS (
          SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "instant"
        )
        UPDATE "InviteCode" AS invite
        SET "isActive" = false,
            "updatedAt" = consumption."instant"
        FROM consumption
        WHERE invite."id" = ${invite.id}
          AND invite."isActive" = true
          AND invite."role" = 'PROFESSOR'::"Role"
          AND invite."expiresAt" > consumption."instant"
        RETURNING invite."id"
      `;
      if (updated.length !== 1)
        throw new BadRequestException(INVITE_UNAVAILABLE);
      return Role.PROFESSOR;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Não foi possível cadastrar.');
    }
  }
}
