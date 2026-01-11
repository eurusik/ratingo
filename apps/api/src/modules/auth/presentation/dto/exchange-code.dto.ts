import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for exchanging one-time OAuth code for tokens.
 */
export class ExchangeCodeDto {
  @ApiProperty({
    description: 'One-time exchange code from OAuth callback',
    example: 'abc123xyz...',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
