/**
 * Providers endpoint DTOs.
 */

import { ApiProperty } from '@nestjs/swagger';

/** Single provider info. */
export class ProviderDto {
  @ApiProperty({ example: 'netflix', description: 'Provider ID (lowercase slug)' })
  id: string;

  @ApiProperty({ example: 'Netflix', description: 'Provider display name' })
  name: string;

  @ApiProperty({ example: 1250, description: 'Number of media items available' })
  count: number;
}

/** Providers list response. */
export class ProvidersListDto {
  @ApiProperty({ type: [ProviderDto], description: 'List of streaming providers' })
  data: ProviderDto[];
}
