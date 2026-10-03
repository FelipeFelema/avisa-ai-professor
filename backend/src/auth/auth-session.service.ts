import { Injectable } from '@nestjs/common';
import { AuthSession, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async prepareRefreshTokenHash(refreshToken: string): Promise<string> {
    return bcrypt.hash(this.digest(refreshToken), PASSWORD_SALT_ROUNDS);
  }

  async create(
    userId: string,
    sessionId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<AuthSession> {
    const refreshTokenHash = await this.prepareRefreshTokenHash(refreshToken);
    return this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash,
        expiresAt,
      },
    });
  }

  async withUserLock<T>(
    userId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
      `;
      return operation(tx);
    });
  }

  async findActiveInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    now = new Date(),
  ): Promise<AuthSession | null> {
    return tx.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AuthSession> {
    return tx.authSession.create({
      data: { id: sessionId, userId, refreshTokenHash, expiresAt },
    });
  }

  async findActive(userId: string, sessionId: string, now = new Date()) {
    return this.prisma.authSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async verifyRefreshToken(
    session: Pick<AuthSession, 'refreshTokenHash'>,
    refreshToken: string,
  ) {
    const digestMatches = await bcrypt.compare(
      this.digest(refreshToken),
      session.refreshTokenHash,
    );
    if (digestMatches) return true;

    // Legacy migrations contain hashes of the raw token. Accept that pair once;
    // the next rotation stores the digest-based representation.
    return bcrypt.compare(refreshToken, session.refreshTokenHash);
  }

  async rotate(
    sessionId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<AuthSession> {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await bcrypt.hash(
          this.digest(refreshToken),
          PASSWORD_SALT_ROUNDS,
        ),
        expiresAt,
      },
    });
  }

  async revokeOthers(userId: string, currentSessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOthersInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    await tx.authSession.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private digest(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
