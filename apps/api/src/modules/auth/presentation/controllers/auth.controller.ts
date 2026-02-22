import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
  UseFilters,
  NotFoundException,
  Req,
  Res,
  Query,
  Inject,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
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
import facebookConfig from '../../../../config/facebook.config';
import googleConfig from '../../../../config/google.config';
import { UserMediaService } from '../../../user-media/application/user-media.service';
import { UsersService } from '../../../users/application/users.service';
import { type User } from '../../../users/domain/entities/user.entity';
import { AuthService } from '../../application/auth.service';
import { HTTP_REDIRECT_FOUND } from '../../auth.constants';
import { type OAuthProvider, type OAuthUserPayload } from '../../domain/types';
import { CurrentUser } from '../../infrastructure/decorators/current-user.decorator';
import { FacebookAuthGuard } from '../../infrastructure/guards/facebook-auth.guard';
import { GoogleAuthGuard } from '../../infrastructure/guards/google-auth.guard';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { LocalAuthGuard } from '../../infrastructure/guards/local-auth.guard';
import { AuthConfigDto } from '../dto/auth-config.dto';
import { AuthTokensDto } from '../dto/auth-tokens.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ExchangeCodeDto } from '../dto/exchange-code.dto';
import { LinkedAccountDto } from '../dto/linked-account.dto';
import { LoginDto } from '../dto/login.dto';
import { MeDto } from '../dto/me.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { RegisterDto } from '../dto/register.dto';
import { UnlinkProviderParamDto } from '../dto/unlink-provider-param.dto';
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
    private readonly googleAuthGuard: GoogleAuthGuard,
    private readonly facebookAuthGuard: FacebookAuthGuard,
    private readonly jwtService: JwtService,
    @Inject(googleConfig.KEY)
    private readonly googleCfg: ConfigType<typeof googleConfig>,
    @Inject(facebookConfig.KEY)
    private readonly facebookCfg: ConfigType<typeof facebookConfig>,
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
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Invalid current password' })
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

    const [stats, linkedProviders] = await Promise.all([
      this.userMediaService.getStats(dbUser.id),
      this.authService.getLinkedProviders(dbUser.id),
    ]);

    return MeMapper.toDto(dbUser, stats, linkedProviders);
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
  @ApiExcludeEndpoint()
  async googleCallback(
    @CurrentUser() oauthUser: OAuthUserPayload,
    @Req() req: FastifyRequest,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    await this.handleOAuthCallback(oauthUser, req, res);
  }

  /**
   * Initiates Facebook OAuth flow. Redirects to Facebook consent screen.
   */
  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'Initiate Facebook OAuth flow' })
  @ApiQuery({ name: 'returnTo', required: false, description: 'URL to redirect after auth' })
  @ApiResponse({ status: 302, description: 'Redirect to Facebook' })
  facebookAuth(@Query('returnTo') _returnTo?: string) {
    // Guard handles redirect to Facebook
    // returnTo is validated and stored in state by FacebookAuthGuard
  }

  /**
   * Facebook OAuth callback. Issues tokens via one-time code.
   */
  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  @ApiExcludeEndpoint()
  async facebookCallback(
    @CurrentUser() oauthUser: OAuthUserPayload,
    @Req() req: FastifyRequest,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    await this.handleOAuthCallback(oauthUser, req, res);
  }

  /**
   * Shared handler for OAuth callbacks (used by all providers).
   */
  private async handleOAuthCallback(
    oauthUser: OAuthUserPayload,
    req: FastifyRequest,
    res: FastifyReply,
  ): Promise<void> {
    const statePayload = req.oauthStatePayload;
    const { frontendUrl } = this.authCfg;

    // Link mode: attach provider to existing user, redirect to settings
    if (statePayload?.mode === 'link' && statePayload.linkUserId) {
      const returnTo = statePayload.returnTo || '/settings';
      const provider = statePayload.provider || oauthUser.provider;
      try {
        await this.authService.linkOAuthAccount(statePayload.linkUserId, oauthUser);
        await res.redirect(HTTP_REDIRECT_FOUND, `${frontendUrl}${returnTo}?linked=${provider}`);
      } catch {
        await res.redirect(
          HTTP_REDIRECT_FOUND,
          `${frontendUrl}${returnTo}?linkError=ALREADY_LINKED&provider=${provider}`,
        );
      }
      return;
    }

    // Login mode (existing logic)
    const clientMeta = extractClientMeta(req);
    const { user } = await this.authService.loginWithOAuth(oauthUser, clientMeta);
    const code = await this.authService.generateExchangeCode(user.id, clientMeta);

    const returnTo = statePayload?.returnTo || '/';
    const provider = statePayload?.provider || oauthUser.provider;

    const redirectUrl = `${frontendUrl}/auth/callback/${provider}?code=${encodeURIComponent(code)}&returnTo=${encodeURIComponent(returnTo)}`;
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
   * Initiates OAuth link flow for Google. Requires access token as query param.
   */
  @Get('link/google')
  @ApiOperation({ summary: 'Link Google account to current user' })
  @ApiQuery({ name: 'token', required: true, description: 'Access token' })
  @ApiQuery({ name: 'returnTo', required: false })
  @ApiResponse({ status: 302, description: 'Redirect to Google' })
  @ApiExcludeEndpoint()
  async linkGoogle(
    @Query('token') token: string,
    @Query('returnTo') returnTo: string | undefined,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const userId = await this.verifyTokenFromQuery(token);
    const signedState = this.googleAuthGuard.buildSignedStateForLink(userId, returnTo);
    this.googleAuthGuard.setStateCookie(res, signedState);
    const authUrl = this.googleAuthGuard.buildAuthUrl(signedState);
    await res.redirect(HTTP_REDIRECT_FOUND, authUrl);
  }

  /**
   * Initiates OAuth link flow for Facebook. Requires access token as query param.
   */
  @Get('link/facebook')
  @ApiOperation({ summary: 'Link Facebook account to current user' })
  @ApiQuery({ name: 'token', required: true, description: 'Access token' })
  @ApiQuery({ name: 'returnTo', required: false })
  @ApiResponse({ status: 302, description: 'Redirect to Facebook' })
  @ApiExcludeEndpoint()
  async linkFacebook(
    @Query('token') token: string,
    @Query('returnTo') returnTo: string | undefined,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const userId = await this.verifyTokenFromQuery(token);
    const signedState = this.facebookAuthGuard.buildSignedStateForLink(userId, returnTo);
    this.facebookAuthGuard.setStateCookie(res, signedState);
    const authUrl = this.facebookAuthGuard.buildAuthUrl(signedState);
    await res.redirect(HTTP_REDIRECT_FOUND, authUrl);
  }

  /**
   * Returns detailed list of linked OAuth accounts for settings page.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('providers')
  @ApiOperation({ summary: 'Get linked OAuth providers' })
  @ApiOkResponse({ description: 'Linked accounts', type: [LinkedAccountDto] })
  async getLinkedAccounts(@CurrentUser() user: { id: string }): Promise<LinkedAccountDto[]> {
    const accounts = await this.authService.getLinkedAccounts(user.id);
    return accounts.map((a) => ({
      provider: a.provider,
      email: a.email,
      displayName: a.displayName,
      linkedAt: a.createdAt.toISOString(),
    }));
  }

  /**
   * Unlinks an OAuth provider from the current user's account.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('providers/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink OAuth provider' })
  @ApiResponse({ status: 204, description: 'Provider unlinked' })
  @ApiForbiddenResponse({ description: 'Cannot unlink last authentication method' })
  async unlinkProvider(
    @CurrentUser() user: { id: string },
    @Param() params: UnlinkProviderParamDto,
  ): Promise<void> {
    await this.authService.unlinkOAuthAccount(user.id, params.provider as OAuthProvider);
  }

  /**
   * Returns auth configuration (enabled OAuth providers).
   */
  @Get('config')
  @ApiOperation({ summary: 'Get auth configuration' })
  @ApiOkResponse({ description: 'Auth configuration', type: AuthConfigDto })
  getConfig(): AuthConfigDto {
    return {
      google: { enabled: this.googleCfg.enabled },
      facebook: { enabled: this.facebookCfg.enabled },
    };
  }

  /**
   * Verifies access token from query parameter (used for link initiation where
   * browser navigation can't send Authorization headers).
   */
  private async verifyTokenFromQuery(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
