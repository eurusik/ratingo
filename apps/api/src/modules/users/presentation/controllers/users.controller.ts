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

import { CurrentUser } from '../../../auth/public';
import { JwtAuthGuard } from '../../../auth/public';
import { AvatarUploadService } from '../../application/avatar-upload.service';
import { UsersService } from '../../application/users.service';
import { AvatarUploadUrlDto, CreateAvatarUploadUrlDto } from '../dto/avatar-upload.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

/**
 * Handles authenticated user profile operations.
 */
@ApiTags('Me: Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
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
    const { passwordHash: _passwordHash, ...safe } = record;
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
      autoSubscribeOnWatch: body.autoSubscribeOnWatch,
    });
    const { passwordHash: _passwordHash, ...safe } = updated;
    return safe;
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
