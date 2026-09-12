import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthSessionService } from './auth-session.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../common/types/jwt-payload.type';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TokenUser = { id: string; email: string; role: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async validateUser(email: string, password: string): Promise<TokenUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    return { id: user.id, email: user.email, role: user.role };
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
    const user = await this.validateUser(email, password);
    return this.issueTokens(user);
  }

  async issueTokens(user: TokenUser, sessionId = crypto.randomUUID()) {
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

    await this.authSessionService.create(
      user.id,
      sessionId,
      refresh_token,
      new Date(Date.now() + REFRESH_SESSION_TTL_MS),
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

    const session = await this.authSessionService.findActive(
      payload.sub,
      payload.sid,
    );
    if (
      !session ||
      !(await this.authSessionService.verifyRefreshToken(session, refreshToken))
    ) {
      throw new UnauthorizedException();
    }

    const user = session.user;
    const newPayload = this.createJwtPayload(
      user.id,
      user.email,
      user.role,
      session.id,
    );
    const access_token = this.jwtService.sign(newPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const newRefreshToken = this.jwtService.sign(
      { ...newPayload, jti: crypto.randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    await this.authSessionService.rotate(
      session.id,
      newRefreshToken,
      new Date(Date.now() + REFRESH_SESSION_TTL_MS),
    );

    return { access_token, refresh_token: newRefreshToken, sid: session.id };
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
