import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

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
            role: user.role
        }
    }

    async register (createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    async login (email: string, password: string) {
        const user = await this.validateUser(email, password);

        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = this.jwtService.sign(payload, {
            expiresIn: '15m',
        });

        const refreshTokenId = crypto.randomUUID();

        const refreshToken = this.jwtService.sign(
            {
                ...payload,
                tokenId: refreshTokenId,
            },
            {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: '7d',
            }
        );

        await this.usersService.updateRefreshToken(user.id, refreshToken, refreshTokenId);

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
        };
    }

    async refreshToken(refreshToken: string) {
        let payload;

        try {
            payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
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

        const newPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const newAccessToken = this.jwtService.sign(newPayload, {
            expiresIn: '15m',
        });

        const newRefreshTokenId = crypto.randomUUID();
        
        const newRefreshToken = this.jwtService.sign(
            {
                ...newPayload,
                tokenId: newRefreshTokenId,
            },
            {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: '7d'
            }
        );

        await this.usersService.updateRefreshToken(user.id, newRefreshToken, newRefreshTokenId);

        return {
            access_token: newAccessToken,
            refresh_token: newRefreshToken
        }
    }
}
