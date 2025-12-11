import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /**
   * User email.
   */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  /**
   * Plain password.
   */
  @ApiProperty({ example: 'S3curePassw0rd' })
  @IsString()
  @MinLength(8)
  password: string;
}
