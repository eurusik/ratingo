import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

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
  newPassword: string;
}
