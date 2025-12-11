import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { UsersService } from '../../application/users.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AuthService } from '../../../auth/application/auth.service';
import { ChangePasswordDto } from '../../../auth/presentation/dto/change-password.dto';

/**
 * Users controller for profile operations.
 */
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Returns current user profile.
   */
  @ApiOperation({ summary: 'Get current user profile (auth: Bearer)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Get('me')
  async me(@CurrentUser() user: { id: string }) {
    const record = await this.usersService.getById(user.id);
    if (!record) return null;
    const { passwordHash, ...safe } = record;
    return safe;
  }

  /**
   * Updates current user profile (username, avatar).
   *
   * @param {UpdateProfileDto} body - Profile payload
   * @returns Updated user
   */
  @ApiOperation({ summary: 'Update current user profile (auth: Bearer)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Patch('me')
  async updateProfile(@CurrentUser() user: { id: string }, @Body() body: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(user.id, {
      username: body.username,
      avatarUrl: body.avatarUrl,
      bio: body.bio,
      location: body.location,
      website: body.website,
      preferredLanguage: body.preferredLanguage,
      preferredRegion: body.preferredRegion,
      isProfilePublic: body.isProfilePublic,
      showWatchHistory: body.showWatchHistory,
      showRatings: body.showRatings,
      allowFollowers: body.allowFollowers,
    });
    const { passwordHash, ...safe } = updated;
    return safe;
  }

  /**
   * Changes password for current user.
   *
   * @param {ChangePasswordDto} body - Current and new password
   */
  @ApiOperation({ summary: 'Change current user password (auth: Bearer)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: { id: string }, @Body() body: ChangePasswordDto) {
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
    return;
  }
}
