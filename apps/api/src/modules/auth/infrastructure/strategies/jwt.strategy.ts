import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import authConfig from '../../../../config/auth.config';

/**
 * JWT strategy for access tokens.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.accessTokenSecret,
    });
  }

  /**
   * Validates JWT payload and maps to request user.
   *
   * @param {{ sub: string; email: string; role: string }} payload - Decoded JWT payload
   * @returns {Promise<{ id: string; email: string; role: string }>} Payload as request user object
   */
  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
