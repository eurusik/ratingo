import { Global, Module } from '@nestjs/common';

import { CLOCK_PORT } from '@ratingo/ai-core';

import { ANALYTICS_MCP_CONFIG } from '../../config/config.constants';
import { AGENT_FOLDER } from '../ai-core.constants';

import { MCP_GATEWAY_HOST } from './mcp.constants';
import { createMcpGatewayHost } from './mcp-gateway.factory';

@Global()
@Module({
  providers: [
    {
      provide: MCP_GATEWAY_HOST,
      inject: [ANALYTICS_MCP_CONFIG, AGENT_FOLDER, CLOCK_PORT],
      useFactory: createMcpGatewayHost,
    },
  ],
  exports: [MCP_GATEWAY_HOST],
})
export class McpModule {}
