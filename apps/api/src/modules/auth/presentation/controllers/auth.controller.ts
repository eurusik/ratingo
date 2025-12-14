import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
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
 * Auth controller: register/login/refresh/logout.
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
   *
   * @param {RegisterDto} body - Registration payload
   * @returns {Promise<any>} Tokens pair
   */
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  async register(@Body() body: RegisterDto) {
    const tokens = await this.authService.register(body.email, body.username, body.password);
    return tokens;
  }

  /**
   * Authenticates user with email/password.
   *
   * @param {LoginDto} body - Login payload
   * @returns {Promise<any>} Tokens pair
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() body: LoginDto) {
    const tokens = await this.authService.login(body.email, body.password);
    return tokens;
  }

  /**
   * Refreshes tokens using valid refresh token.
   *
   * @param {RefreshDto} body - Refresh payload
   * @returns {Promise<any>} Tokens pair
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh tokens' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: 'Tokens pair', type: AuthTokensDto })
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  /**
   * Logs out user by revoking all refresh tokens.
   *
   * @returns {Promise<void>} Nothing
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
   *
   * @param {{ id: string; email: string; role: string }} user - Current user context
   * @returns {Promise<MeDto>} Current user profile
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
