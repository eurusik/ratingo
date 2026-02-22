import { ApiProperty } from '@nestjs/swagger';

import { IsIn } from 'class-validator';

import { OAUTH_PROVIDER } from '../../domain/types';

/**
 * Path parameter DTO for unlink endpoint.
 */
export class UnlinkProviderParamDto {
  @ApiProperty({
    enum: Object.values(OAUTH_PROVIDER),
    description: 'OAuth provider to unlink',
    example: 'google',
  })
  @IsIn(Object.values(OAUTH_PROVIDER))
  provider: string;
}
