import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a linked OAuth account in settings.
 */
export class LinkedAccountDto {
  @ApiProperty({ example: 'google', description: 'OAuth provider name' })
  provider: string;

  @ApiPropertyOptional({
    example: 'user@gmail.com',
    nullable: true,
    description: 'Email from OAuth provider',
  })
  email: string | null;

  @ApiPropertyOptional({
    example: 'John Doe',
    nullable: true,
    description: 'Display name from OAuth provider',
  })
  displayName: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2025-01-15T10:30:00.000Z',
    description: 'When the account was linked',
  })
  linkedAt: string;
}
