import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthSessionService } from '../auth-session.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (
      !payload.sid ||
      !(await this.authSessionService.findActive(payload.sub, payload.sid))
    ) {
      throw new UnauthorizedException();
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sid: payload.sid,
    };
  }
}
