import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from 'src/common/types/jwt-payload.type';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const passWordMatch = await bcrypt.compare(password, user.password);

    if (!passWordMatch) {
      throw new UnauthorizedException('Email ou senha invalidos');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(createUserDto);
    const { access_token, refresh_token, tokenId } = this.generateTokens(
      user.id,
      user.email,
      user.role,
    );

    await this.usersService.updateRefreshToken(user.id, refresh_token, tokenId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      access_token,
      refresh_token,
    };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const payload = this.createJwtPayload(user.id, user.email, user.role);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshTokenId = crypto.randomUUID();

    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        tokenId: refreshTokenId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    await this.usersService.updateRefreshToken(
      user.id,
      refreshToken,
      refreshTokenId,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  generateTokens(userId: string, email: string, role: string) {
    const tokenId = crypto.randomUUID();

    const access_token = this.jwtService.sign(
      this.createJwtPayload(userId, email, role),
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );

    const refresh_token = this.jwtService.sign(
      { ...this.createJwtPayload(userId, email, role), tokenId },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    return {
      access_token,
      refresh_token,
      tokenId,
    };
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

    const user = await this.usersService.findByIdInternal(payload.sub);

    if (!user || !user.refreshTokenHash || !user.refreshTokenId) {
      throw new UnauthorizedException();
    }

    if (!payload.tokenId || payload.tokenId !== user.refreshTokenId) {
      throw new UnauthorizedException();
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isMatch) {
      throw new UnauthorizedException();
    }

    const newPayload = this.createJwtPayload(user.id, user.email, user.role);

    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const newRefreshTokenId = crypto.randomUUID();

    const newRefreshToken = this.jwtService.sign(
      {
        ...newPayload,
        tokenId: newRefreshTokenId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    await this.usersService.updateRefreshToken(
      user.id,
      newRefreshToken,
      newRefreshTokenId,
    );

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  private createJwtPayload(userId: string, email: string, role: string) {
    return {
      sub: userId,
      email,
      role,
    };
  }
}
