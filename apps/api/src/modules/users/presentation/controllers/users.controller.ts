import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from '../../application/users.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AuthService } from '../../../auth/application/auth.service';
import { ChangePasswordDto } from '../../../auth/presentation/dto/change-password.dto';
import { AvatarUploadService } from '../../application/avatar-upload.service';
import { AvatarUploadUrlDto, CreateAvatarUploadUrlDto } from '../dto/avatar-upload.dto';

/**
 * Handles authenticated user profile operations.
 */
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly avatarUploadService: AvatarUploadService,
  ) {}

  /**
   * Gets current user profile.
   *
   * @param {{ id: string } | null} user - Current user context
   * @returns {Promise<any>} Current user profile without password hash
   * @throws {UnauthorizedException} When request is unauthenticated
   */
  @ApiOperation({ summary: 'Get current user profile (auth: Bearer)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Get('me')
  async me(@CurrentUser() user: { id: string } | null) {
    if (!user) throw new UnauthorizedException();
    const record = await this.usersService.getById(user.id);
    if (!record) return null;
    const { passwordHash, ...safe } = record;
    return safe;
  }

  /**
   * Updates current user profile.
   *
   * @param {{ id: string } | null} user - Current user context
   * @param {UpdateProfileDto} body - Profile update payload
   * @returns {Promise<any>} Updated user profile without password hash
   * @throws {UnauthorizedException} When request is unauthenticated
   */
  @ApiOperation({ summary: 'Update current user profile (auth: Bearer)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Patch('me')
  async updateProfile(@CurrentUser() user: { id: string } | null, @Body() body: UpdateProfileDto) {
    if (!user) throw new UnauthorizedException();
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
   * Changes current user password.
   *
   * @param {{ id: string } | null} user - Current user context
   * @param {ChangePasswordDto} body - Password change payload
   * @returns {Promise<void>} Nothing
   * @throws {UnauthorizedException} When request is unauthenticated
   */
  @ApiOperation({ summary: 'Change current user password (auth: Bearer)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: { id: string } | null,
    @Body() body: ChangePasswordDto,
  ) {
    if (!user) throw new UnauthorizedException();
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
    return;
  }

  /**
   * Creates presigned upload URL for avatar.
   *
   * @param {{ id: string } | null} user - Current user context
   * @param {CreateAvatarUploadUrlDto} body - Upload URL request payload
   * @returns {Promise<AvatarUploadUrlDto>} Presigned upload URL result
   * @throws {UnauthorizedException} When request is unauthenticated
   */
  @ApiOperation({ summary: 'Create presigned upload URL for avatar (auth: Bearer)' })
  @ApiOkResponse({ type: AvatarUploadUrlDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Post('me/avatar/upload-url')
  @HttpCode(HttpStatus.OK)
  async createAvatarUploadUrl(
    @CurrentUser() user: { id: string } | null,
    @Body() body: CreateAvatarUploadUrlDto,
  ): Promise<AvatarUploadUrlDto> {
    if (!user) throw new UnauthorizedException();
    return this.avatarUploadService.createUploadUrl(user.id, body.contentType);
  }
}
