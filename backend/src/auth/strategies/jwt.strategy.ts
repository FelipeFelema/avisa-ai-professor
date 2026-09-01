import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthSessionService } from '../auth-session.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sid) {
      throw new UnauthorizedException();
    }

    const session = await this.authSessionService.findActive(
      payload.sub,
      payload.sid,
    );
    if (!session) {
      throw new UnauthorizedException();
    }

    return { ...session.user, sid: session.id };
  }
}
