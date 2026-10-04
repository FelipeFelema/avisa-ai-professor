import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    return this.withUserLock(userId, (tx) =>
      this.createInTransaction(
        tx,
        userId,
        sessionId,
        refreshTokenHash,
        expiresAt,
      ),
    );
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
    if (
      !(await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }))
    )
      throw new UnauthorizedException();
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
    const snapshot = await this.prisma.authSession.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!snapshot) throw new UnauthorizedException();
    const preparedHash = await this.prepareRefreshTokenHash(refreshToken);
    await this.withUserLock(snapshot.userId, (tx) =>
      this.rotateInTransaction(
        tx,
        snapshot.userId,
        sessionId,
        snapshot.refreshTokenHash,
        preparedHash,
        expiresAt,
      ),
    );
    const current = await this.findActive(snapshot.userId, sessionId);
    if (!current) throw new UnauthorizedException();
    return current;
  }

  async rotateInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    expectedHash: string,
    preparedHash: string,
    expiresAt: Date,
  ): Promise<void> {
    if (
      !(await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }))
    )
      throw new UnauthorizedException();
    const active = await this.findActiveInTransaction(tx, userId, sessionId);
    if (!active || active.refreshTokenHash !== expectedHash)
      throw new UnauthorizedException();
    const result = await tx.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        refreshTokenHash: expectedHash,
      },
      data: { refreshTokenHash: preparedHash, expiresAt },
    });
    if (result.count !== 1) throw new UnauthorizedException();
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
