import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  /**
   * User email (unique).
   */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  /**
   * Username (unique).
   */
  @ApiProperty({ example: 'ratingo_fan' })
  @IsString()
  @MinLength(3)
  username: string;

  /**
   * Plain password.
   */
  @ApiProperty({ example: 'S3curePassw0rd' })
  @IsString()
  @MinLength(8)
  password: string;

  /**
   * Optional avatar URL.
   */
  @ApiProperty({ example: 'https://cdn.example.com/avatar.png', required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
