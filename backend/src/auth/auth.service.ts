import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import {
  hashPassword,
  verifyPassword,
} from '../common/security/password-hasher';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthSessionService } from './auth-session.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../common/types/jwt-payload.type';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TokenUser = { id: string; email: string; role: string };
type VerifiedCredentials = {
  user: TokenUser;
  credentialSnapshot: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async validateUser(email: string, password: string): Promise<TokenUser> {
    const verified = await this.verifyCredentials(email, password);
    return verified.user;
  }

  async changePassword(
    userId: string,
    sid: string,
    request: ChangePasswordDto,
  ): Promise<void> {
    try {
      if (request.confirmNewPassword !== request.newPassword)
        throw new BadRequestException('PASSWORD_CONFIRMATION_MISMATCH');
      if (request.newPassword === request.currentPassword)
        throw new BadRequestException('PASSWORD_UNCHANGED');
      const snapshot = await this.usersService.findByIdInternal(userId);
      if (!(await verifyPassword(request.currentPassword, snapshot.password)))
        throw new BadRequestException('CURRENT_PASSWORD_INVALID');
      const replacement = await hashPassword(request.newPassword);

      await this.authSessionService.withUserLock(userId, async (tx) => {
        const active = await this.authSessionService.findActiveInTransaction(
          tx,
          userId,
          sid,
        );
        if (!active) throw new UnauthorizedException();
        const current = await tx.user.findUnique({
          where: { id: userId },
          select: { password: true },
        });
        if (!current || current.password !== snapshot.password)
          throw new ConflictException('CREDENTIAL_CHANGED');
        await tx.user.update({
          where: { id: userId },
          data: { password: replacement },
        });
        await this.authSessionService.revokeOthersInTransaction(
          tx,
          userId,
          sid,
        );
      });
    } catch (error) {
      if (
        error instanceof BadRequestException &&
        [
          'CURRENT_PASSWORD_INVALID',
          'PASSWORD_UNCHANGED',
          'PASSWORD_CONFIRMATION_MISMATCH',
        ].includes(error.message)
      )
        throw error;
      if (
        error instanceof UnauthorizedException &&
        error.message === 'Unauthorized'
      )
        throw error;
      if (
        error instanceof ConflictException &&
        error.message === 'CREDENTIAL_CHANGED'
      )
        throw error;
      // Do not keep the original database/crypto error as a cause or log it.
      throw new InternalServerErrorException(
        'Não foi possível alterar a senha.',
      );
    }
  }

  private async verifyCredentials(
    email: string,
    password: string,
  ): Promise<VerifiedCredentials> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    return {
      user: { id: user.id, email: user.email, role: user.role },
      credentialSnapshot: user.password,
    };
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(createUserDto);
    const tokens = await this.issueTokens(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  async login(email: string, password: string) {
    const verified = await this.verifyCredentials(email, password);
    return this.persistTokens(
      verified.user.id,
      crypto.randomUUID(),
      verified.credentialSnapshot,
    );
  }

  async issueTokens(user: TokenUser, sessionId = crypto.randomUUID()) {
    return this.persistTokens(user.id, sessionId);
  }

  private async readTokenUser(tx: Prisma.TransactionClient, userId: string) {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, password: true },
    });
    if (!current) throw new UnauthorizedException();
    return current;
  }

  // A read-only lock pass obtains current claims after waiting. Hashing occurs
  // after that transaction closes; a second lock pass revalidates the snapshot
  // before writing. Identity/credential changes fail closed, without retries.
  private async persistTokens(
    userId: string,
    sid: string,
    credential?: string,
  ) {
    try {
      const snapshot = await this.authSessionService.withUserLock(
        userId,
        async (tx) => {
          const current = await this.readTokenUser(tx, userId);
          if (credential !== undefined && current.password !== credential)
            throw new UnauthorizedException();
          return current;
        },
      );
      const tokens = this.createTokens(snapshot, sid);
      const hash = await this.authSessionService.prepareRefreshTokenHash(
        tokens.refresh_token,
      );
      return await this.authSessionService.withUserLock(userId, async (tx) => {
        const current = await this.readTokenUser(tx, userId);
        if (
          current.password !== snapshot.password ||
          current.email !== snapshot.email ||
          current.role !== snapshot.role
        )
          throw new UnauthorizedException();
        await this.authSessionService.createInTransaction(
          tx,
          userId,
          sid,
          hash,
          new Date(Date.now() + REFRESH_SESSION_TTL_MS),
        );
        return tokens;
      });
    } catch (error) {
      if (error instanceof UnauthorizedException)
        throw new UnauthorizedException();
      throw new InternalServerErrorException('Não foi possível autenticar.');
    }
  }

  private createTokens(user: TokenUser, sessionId: string) {
    const payload = this.createJwtPayload(
      user.id,
      user.email,
      user.role,
      sessionId,
    );
    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const refresh_token = this.jwtService.sign(
      { ...payload, jti: crypto.randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    return { access_token, refresh_token, sid: sessionId };
  }

  async refreshToken(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }

    if (!payload.sid) {
      throw new UnauthorizedException();
    }

    try {
      const session = await this.authSessionService.findActive(
        payload.sub,
        payload.sid,
      );
      if (
        !session ||
        !(await this.authSessionService.verifyRefreshToken(
          session,
          refreshToken,
        ))
      )
        throw new UnauthorizedException();
      const validateSession = async (tx: Prisma.TransactionClient) => {
        const active = await this.authSessionService.findActiveInTransaction(
          tx,
          payload.sub,
          payload.sid,
        );
        if (!active || active.refreshTokenHash !== session.refreshTokenHash)
          throw new UnauthorizedException();
      };
      const snapshot = await this.authSessionService.withUserLock(
        payload.sub,
        async (tx) => {
          const current = await this.readTokenUser(tx, payload.sub);
          await validateSession(tx);
          return current;
        },
      );
      const tokens = this.createTokens(snapshot, payload.sid);
      const hash = await this.authSessionService.prepareRefreshTokenHash(
        tokens.refresh_token,
      );
      return await this.authSessionService.withUserLock(
        payload.sub,
        async (tx) => {
          const current = await this.readTokenUser(tx, payload.sub);
          await validateSession(tx);
          if (
            current.password !== snapshot.password ||
            current.email !== snapshot.email ||
            current.role !== snapshot.role
          )
            throw new UnauthorizedException();
          await this.authSessionService.rotateInTransaction(
            tx,
            payload.sub,
            payload.sid,
            session.refreshTokenHash,
            hash,
            new Date(Date.now() + REFRESH_SESSION_TTL_MS),
          );
          return tokens;
        },
      );
    } catch (error) {
      if (error instanceof UnauthorizedException)
        throw new UnauthorizedException();
      throw new InternalServerErrorException('Não foi possível autenticar.');
    }
  }

  private createJwtPayload(
    userId: string,
    email: string,
    role: string,
    sid: string,
  ) {
    return { sub: userId, email, role, sid };
  }
}
