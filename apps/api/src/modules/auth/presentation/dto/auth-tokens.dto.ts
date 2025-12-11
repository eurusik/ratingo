import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YmQ1NGU2Mi1iYWMzLTQ5ZGQtYTBkNC0wNWVmZDc3NjE3MDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NTQ1ODE3NCwiZXhwIjoxNzY1NDU5MDc0fQ.JYlxU9C9P_DJOJTeN_tosd5Dds5H5u3U9_y_AQdLtDU',
    description: 'JWT access token',
  })
  accessToken!: string;

  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YmQ1NGU2Mi1iYWMzLTQ5ZGQtYTBkNC0wNWVmZDc3NjE3MDAiLCJqdGkiOiJmYmUwYTQxOC05ZWVkLTRjNmEtOTU2MS00MDRmZDFiMTFhOTciLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc2NTQ1ODE3NCwiZXhwIjoxNzY4MDUwMTc0fQ.Jra2xAp4OeKcm5ZSalwwMrqwoQngn8Js9ql_rK0VjFQ',
    description: 'Refresh token',
  })
  refreshToken!: string;
}
