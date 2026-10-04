import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountDeletionImpactDto } from './dto/account-deletion-impact.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { verifyPassword } from '../common/security/password-hasher';

// All account deletions acquire the same fixed transaction-scoped gate before
// any User row lock, so concurrent ADMIN decisions observe committed state.
const ACCOUNT_DELETION_GATE_NAMESPACE = 0x41564953;
const ACCOUNT_DELETION_GATE_ID = 1;

@Injectable()
export class AccountDeletionService {
  constructor(private readonly prisma: PrismaService) {}

  async deleteOwnAccount(
    userId: string,
    sid: string,
    request: Pick<DeleteAccountDto, 'currentPassword' | 'confirmationPhrase'>,
  ): Promise<void> {
    if (request.confirmationPhrase !== 'EXCLUIR MINHA CONTA')
      throw new BadRequestException('ACCOUNT_DELETION_CONFIRMATION_MISMATCH');

    try {
      // Password derivation stays outside all locks. The hash is only a
      // snapshot; the transaction below verifies it did not change meanwhile.
      const snapshot = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });
      if (!snapshot) throw new UnauthorizedException();
      if (!(await verifyPassword(request.currentPassword, snapshot.password)))
        throw new BadRequestException('CURRENT_PASSWORD_INVALID');

      await this.prisma.$transaction(
        async (tx) => {
          // Fixed, parameterized protocol: account gate -> User -> owned
          // Classrooms -> session/receipt/relationship writes.
          await tx.$queryRaw`
            SELECT 1 AS "locked" FROM pg_advisory_xact_lock(
              ${ACCOUNT_DELETION_GATE_NAMESPACE},
              ${ACCOUNT_DELETION_GATE_ID}
            )
          `;
          await tx.$queryRaw`
            SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
          `;

          const current = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, password: true, role: true },
          });
          if (!current) throw new UnauthorizedException();

          const session = await tx.authSession.findFirst({
            where: {
              id: sid,
              userId,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          });
          if (!session) throw new UnauthorizedException();
          if (current.password !== snapshot.password)
            throw new ConflictException('CREDENTIAL_CHANGED');

          if (
            current.role === Role.ADMIN &&
            (await tx.user.count({ where: { role: Role.ADMIN } })) <= 1
          )
            throw new ConflictException('LAST_ADMIN_REQUIRED');

          await tx.$queryRaw`
            SELECT "id" FROM "Classroom"
            WHERE "ownerId" = ${userId}
            ORDER BY "id" ASC
            FOR UPDATE
          `;

          await tx.announcement.deleteMany({ where: { authorId: userId } });
          await tx.userClassroom.deleteMany({ where: { userId } });
          await tx.classroom.deleteMany({ where: { ownerId: userId } });
          await tx.classroomDeletionReceipt.deleteMany({
            where: { ownerId: userId },
          });
          await tx.authSession.deleteMany({ where: { userId } });
          await tx.user.delete({ where: { id: userId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException &&
        [
          'CURRENT_PASSWORD_INVALID',
          'ACCOUNT_DELETION_CONFIRMATION_MISMATCH',
        ].includes(error.message)
      )
        throw error;
      if (error instanceof UnauthorizedException)
        throw new UnauthorizedException();
      if (
        error instanceof ConflictException &&
        ['CREDENTIAL_CHANGED', 'LAST_ADMIN_REQUIRED'].includes(error.message)
      )
        throw error;
      // Never retain a database/SQL/crypto error or retry a destructive request.
      throw new InternalServerErrorException(
        'Não foi possível excluir a conta.',
      );
    }
  }

  async getImpact(
    userId: string,
    sid: string,
  ): Promise<AccountDeletionImpactDto> {
    try {
      // Every read uses this single consistent snapshot, without the destructive
      // advisory gate or row locks. Expired announcements are intentionally counted.
      return await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          const session = await tx.authSession.findFirst({
            where: {
              id: sid,
              userId,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          });
          if (!user || !session) throw new UnauthorizedException();
          const lastAdmin =
            user.role === Role.ADMIN &&
            (await tx.user.count({ where: { role: Role.ADMIN } })) <= 1;
          const ownedClassroomsCount = await tx.classroom.count({
            where: { ownerId: userId },
          });
          const announcementsInOwnedClassroomsCount =
            await tx.announcement.count({
              where: { classroom: { ownerId: userId } },
            });
          const externalMembershipsCount = await tx.userClassroom.count({
            where: { userId, classroom: { ownerId: { not: userId } } },
          });
          const authoredAnnouncementsInOtherClassroomsCount =
            await tx.announcement.count({
              where: {
                authorId: userId,
                classroom: { ownerId: { not: userId } },
              },
            });
          return {
            role: user.role,
            canDelete: !lastAdmin,
            blockReason: lastAdmin ? 'LAST_ADMIN_REQUIRED' : null,
            ownedClassroomsCount,
            announcementsInOwnedClassroomsCount,
            externalMembershipsCount,
            authoredAnnouncementsInOtherClassroomsCount,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    } catch (error) {
      if (error instanceof UnauthorizedException)
        throw new UnauthorizedException();
      throw new InternalServerErrorException(
        'Não foi possível consultar o impacto da exclusão.',
      );
    }
  }
}
