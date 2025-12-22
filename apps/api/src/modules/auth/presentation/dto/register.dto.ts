import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  /**
   * User email (unique).
   */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  /**
   * Username (unique, alphanumeric with underscores).
   */
  @ApiProperty({ example: 'ratingo_fan' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain letters, numbers, and underscores',
  })
  username: string;

  /**
   * Password with strength requirements:
   * - At least 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   */
  @ApiProperty({ example: 'S3curePassw0rd' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  /**
   * Optional avatar URL.
   */
  @ApiProperty({ example: 'https://cdn.example.com/avatar.png', required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
