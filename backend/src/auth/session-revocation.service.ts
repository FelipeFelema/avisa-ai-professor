import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';
import { SessionRevocationDto } from './dto/session-revocation.dto';

@Injectable()
export class SessionRevocationService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: AuthSessionService,
  ) {}

  private capability(sid: string): string {
    // Domain-separated MAC: neither a JWT nor a digest of an auth token.
    // Stable across rotations, with authority limited to destroying one sid.
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    )
      .update('avisa/session-revocation/v1\0')
      .update(sid)
      .digest('base64url');
  }

  async issue(userId: string, sid: string): Promise<SessionRevocationDto> {
    if (!(await this.sessions.findActive(userId, sid)))
      throw new UnauthorizedException();
    return { sid, capability: this.capability(sid) };
  }

  async revoke(request: SessionRevocationDto): Promise<void> {
    const expected = Buffer.from(this.capability(request.sid), 'base64url');
    const provided = Buffer.from(request.capability, 'base64url');
    if (
      provided.length !== expected.length ||
      provided.toString('base64url') !== request.capability ||
      !timingSafeEqual(provided, expected)
    )
      throw new UnauthorizedException();
    try {
      const session = await this.prisma.authSession.findUnique({
        where: { id: request.sid },
        select: { userId: true },
      });
      if (!session) return;
      // Same User lock as refresh; a concurrent rotation cannot revive this sid.
      await this.sessions.withUserLock(session.userId, async (tx) => {
        await tx.authSession.updateMany({
          where: { id: request.sid, userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    } catch {
      throw new InternalServerErrorException(
        'Não foi possível encerrar a sessão.',
      );
    }
  }
}
