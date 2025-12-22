import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  NotFoundException,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';
import { AuthService } from '../../application/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { LocalAuthGuard } from '../../infrastructure/guards/local-auth.guard';
import { CurrentUser } from '../../infrastructure/decorators/current-user.decorator';
import { MeDto } from '../dto/me.dto';
import { AuthTokensDto } from '../dto/auth-tokens.dto';
import { UsersService } from '../../../users/application/users.service';
import { UserMediaService } from '../../../user-media/application/user-media.service';

/**
 * Safely extracts a header value as trimmed string or null.
 */
function getHeader(req: FastifyRequest, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string') return v.trim() || null;
  return null;
}

/**
 * Extracts client metadata from request for token binding.
 * Handles Cloudflare and standard proxy headers.
 */
function extractClientMeta(req: FastifyRequest): { userAgent: string | null; ip: string | null } {
  // Cloudflare (найкращий сигнал)
  const cfIp = getHeader(req, 'cf-connecting-ip');
  // Standard proxy chain
  const xff = getHeader(req, 'x-forwarded-for');

  const ip = cfIp ?? (xff ? xff.split(',')[0].trim() : null) ?? (req.ip ? req.ip.trim() : null);

  const userAgent = getHeader(req, 'user-agent');

  return { userAgent, ip };
}

/**
 * Auth controller: register/login/refresh/logout.
 * Protected with strict rate limiting on sensitive endpoints.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly userMediaService: UserMediaService,
  ) {}

  /**
   * Registers a new user.
   * Rate limited: 10 requests per minute (inline limit for brute-force protection).
   */
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  @ApiTooManyRequestsResponse({ description: 'Too many registration attempts' })
  async register(@Body() body: RegisterDto, @Req() req: FastifyRequest) {
    const clientMeta = extractClientMeta(req);
    const tokens = await this.authService.register(
      body.email,
      body.username,
      body.password,
      clientMeta,
    );
    return tokens;
  }

  /**
   * Authenticates user with email/password.
   * Rate limited: 10 requests per minute to prevent brute-force.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async login(@Body() body: LoginDto, @Req() req: FastifyRequest) {
    const clientMeta = extractClientMeta(req);
    const tokens = await this.authService.login(body.email, body.password, clientMeta);
    return tokens;
  }

  /**
   * Refreshes tokens using valid refresh token.
   * Rate limited: 30 requests per minute (higher to avoid breaking sessions).
   */
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh tokens' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  @ApiTooManyRequestsResponse({ description: 'Too many refresh attempts' })
  async refresh(@Body() body: RefreshDto, @Req() req: FastifyRequest) {
    const clientMeta = extractClientMeta(req);
    return this.authService.refresh(body.refreshToken, clientMeta);
  }

  /**
   * Logs out user by revoking all refresh tokens.
   * Uses strict tier (120 req/min) - normal mutation rate.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout (revoke refresh tokens)' })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: { id: string }) {
    await this.authService.logout(user.id);
    return;
  }

  /**
   * Returns current authenticated user (basic payload).
   * Uses default throttler (600 req/min) - normal browsing.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Current authenticated user', type: MeDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiOperation({ summary: 'Get current user profile' })
  @Get('me')
  async me(@CurrentUser() user: { id: string; email: string; role: string }): Promise<MeDto> {
    const dbUser = await this.usersService.getById(user.id);
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }

    const stats = await this.userMediaService.getStats(dbUser.id);

    return {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      avatarUrl: dbUser.avatarUrl,
      role: dbUser.role as MeDto['role'],
      profile: {
        bio: dbUser.bio,
        location: dbUser.location,
        website: dbUser.website,
        preferredLanguage: dbUser.preferredLanguage,
        preferredRegion: dbUser.preferredRegion,
        privacy: {
          isProfilePublic: dbUser.isProfilePublic,
          showWatchHistory: dbUser.showWatchHistory,
          showRatings: dbUser.showRatings,
          allowFollowers: dbUser.allowFollowers,
        },
      },
      stats,
    };
  }
}
