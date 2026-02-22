import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth provider availability status.
 */
class ProviderConfigDto {
  @ApiProperty({ description: 'Whether this OAuth provider is enabled' })
  enabled: boolean;
}

/**
 * Auth configuration response (enabled OAuth providers).
 */
export class AuthConfigDto {
  @ApiProperty({ type: ProviderConfigDto, description: 'Google OAuth configuration' })
  google: ProviderConfigDto;

  @ApiProperty({ type: ProviderConfigDto, description: 'Facebook OAuth configuration' })
  facebook: ProviderConfigDto;
}
