import { ApiProperty } from '@nestjs/swagger';

import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

import { PASSWORD_REGEX, PASSWORD_MESSAGE } from '../validators/password.constants';

/**
 * Change password payload.
 */
export class ChangePasswordDto {
  /**
   * Current password for verification.
   */
  @ApiProperty({ example: 'OldPass123' })
  @IsString()
  @MinLength(8)
  currentPassword: string;

  /**
   * New password to set.
   */
  @ApiProperty({ example: 'NewPass456' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
