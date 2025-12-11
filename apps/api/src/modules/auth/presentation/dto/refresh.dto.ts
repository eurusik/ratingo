import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Refresh token payload.
 */
export class RefreshDto {
  /**
   * Refresh token string.
   */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  refreshToken: string;
}
