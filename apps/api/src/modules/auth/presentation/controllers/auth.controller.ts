import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
  UseFilters,
  NotFoundException,
  Req,
  Res,
  Query,
  Inject,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { type FastifyReply, type FastifyRequest } from 'fastify';

import authConfig from '../../../../config/auth.config';
import googleConfig from '../../../../config/google.config';
import { UserMediaService } from '../../../user-media/application/user-media.service';
import { UsersService } from '../../../users/application/users.service';
import { type User } from '../../../users/domain/entities/user.entity';
import { AuthService } from '../../application/auth.service';
import { HTTP_REDIRECT_FOUND } from '../../auth.constants';
import { type GoogleUserPayload } from '../../domain/types';
import { CurrentUser } from '../../infrastructure/decorators/current-user.decorator';
import { GoogleAuthGuard } from '../../infrastructure/guards/google-auth.guard';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { LocalAuthGuard } from '../../infrastructure/guards/local-auth.guard';
import { AuthTokensDto } from '../dto/auth-tokens.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ExchangeCodeDto } from '../dto/exchange-code.dto';
import { LoginDto } from '../dto/login.dto';
import { MeDto } from '../dto/me.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { RegisterDto } from '../dto/register.dto';
import { OAuthExceptionFilter } from '../filters/oauth-exception.filter';
import { MeMapper } from '../mappers/me.mapper';

function getHeader(req: FastifyRequest, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string') return v.trim() || null;
  return null;
}

/**
 * Extracts client metadata from request for token binding.
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
 * Authentication controller.
 * Handles register, login, refresh, logout, and OAuth flows.
 */
@ApiTags('Auth')
@UseFilters(OAuthExceptionFilter)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly userMediaService: UserMediaService,
    @Inject(googleConfig.KEY)
    private readonly googleCfg: ConfigType<typeof googleConfig>,
    @Inject(authConfig.KEY)
    private readonly authCfg: ConfigType<typeof authConfig>,
  ) {}

  /**
   * Registers a new user.
   */
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  @ApiTooManyRequestsResponse({ description: 'Too many registration attempts' })
  async register(@Body() body: RegisterDto, @Req() req: FastifyRequest): Promise<AuthTokensDto> {
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
   * LocalStrategy validates credentials and sets the full User on req.user.
   * This method simply issues tokens for the already-validated user.
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
  async login(@CurrentUser() user: User, @Req() req: FastifyRequest): Promise<AuthTokensDto> {
    const clientMeta = extractClientMeta(req);
    return this.authService.loginValidatedUser(user, clientMeta);
  }

  /**
   * Refreshes tokens using valid refresh token.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh tokens' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  @ApiTooManyRequestsResponse({ description: 'Too many refresh attempts' })
  async refresh(@Body() body: RefreshDto, @Req() req: FastifyRequest): Promise<AuthTokensDto> {
    const clientMeta = extractClientMeta(req);
    return this.authService.refresh(body.refreshToken, clientMeta);
  }

  /**
   * Logs out user by revoking all refresh tokens.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout (revoke refresh tokens)' })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: { id: string }): Promise<void> {
    await this.authService.logout(user.id);
    return;
  }

  /**
   * Changes current user password.
   *
   * @param {{ id: string }} user - Current user context
   * @param {ChangePasswordDto} body - Password change payload
   * @returns {Promise<void>} Nothing
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Password changed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  /**
   * Returns current authenticated user profile.
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

    return MeMapper.toDto(dbUser, stats);
  }

  /**
   * Initiates Google OAuth flow. Redirects to Google consent screen.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiQuery({ name: 'returnTo', required: false, description: 'URL to redirect after auth' })
  @ApiResponse({ status: 302, description: 'Redirect to Google' })
  googleAuth(@Query('returnTo') _returnTo?: string) {
    // Guard handles redirect to Google
    // returnTo is validated and stored in state by GoogleAuthGuard
  }

  /**
   * Google OAuth callback. Issues tokens via one-time code.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with exchange code' })
  async googleCallback(
    @CurrentUser() googleUser: GoogleUserPayload,
    @Req() req: FastifyRequest,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const clientMeta = extractClientMeta(req);
    const { user } = await this.authService.loginWithGoogle(googleUser, clientMeta);
    const code = await this.authService.generateExchangeCode(user.id, clientMeta);

    // Extract returnTo from decoded state payload (set by guard after validation)
    const returnTo = req.oauthStatePayload?.returnTo || '/';
    const { frontendUrl } = this.authCfg;

    const redirectUrl = `${frontendUrl}/auth/callback/google?code=${encodeURIComponent(code)}&returnTo=${encodeURIComponent(returnTo)}`;
    await res.redirect(HTTP_REDIRECT_FOUND, redirectUrl);
  }

  /**
   * Exchanges one-time code for tokens. Provider-agnostic endpoint.
   */
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange one-time code for tokens' })
  @ApiBody({ type: ExchangeCodeDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'OAUTH_EXCHANGE_EXPIRED or OAUTH_EXCHANGE_USED' })
  @ApiTooManyRequestsResponse({ description: 'Too many exchange attempts' })
  async exchangeCode(
    @Body() body: ExchangeCodeDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthTokensDto> {
    const clientMeta = extractClientMeta(req);
    return this.authService.exchangeCodeForTokens(body.code, clientMeta);
  }

  /**
   * Returns auth configuration (enabled OAuth providers).
   */
  @Get('config')
  @ApiOperation({ summary: 'Get auth configuration' })
  @ApiOkResponse({
    description: 'Auth configuration',
    schema: {
      type: 'object',
      properties: {
        google: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
          },
        },
      },
    },
  })
  getConfig() {
    return {
      google: { enabled: this.googleCfg.enabled },
    };
  }
}
