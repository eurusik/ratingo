import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * Payload for updating user profile.
 */
export class UpdateProfileDto {
  /**
   * New username.
   */
  @ApiProperty({ example: 'ratingo_fan', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  /**
   * Avatar URL.
   */
  @ApiProperty({ example: 'https://cdn.example.com/avatar.png', required: false })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;

  @ApiProperty({ example: 'Люблю фільми жахів та наукову фантастику', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string | null;

  @ApiProperty({ example: 'Kyiv, Ukraine', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string | null;

  @ApiProperty({ example: 'https://instagram.com/myprofile', required: false })
  @IsOptional()
  @IsString()
  website?: string | null;

  @ApiProperty({ example: 'uk', required: false })
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @ApiProperty({ example: 'UA', required: false })
  @IsOptional()
  @IsString()
  preferredRegion?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isProfilePublic?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  showWatchHistory?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  showRatings?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  allowFollowers?: boolean;
}
