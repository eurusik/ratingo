import { Logger } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

import {
  McpGateway,
  OtelMcpTelemetry,
  StdioMcpTransport,
  createPlatformMcpRegistry,
  type AgentFolder,
  type ClockPort,
  type RunLogger,
} from '@ratingo/ai-core';

import type { AnalyticsMcpConfig } from '../../config/config.constants';
import { SERVICE_NAME } from '../../telemetry/telemetry.constants';

import { prepareAnalyticsMcpEnv } from './analytics-mcp.env';
import { McpGatewayHost } from './mcp-gateway.host';

const logger = new Logger('McpGateway');

const mcpLogger: RunLogger = {
  info: (event, fields) => logger.log(`${event} ${JSON.stringify(fields)}`),
};

export async function createMcpGatewayHost(
  config: AnalyticsMcpConfig,
  folder: AgentFolder,
  clock: ClockPort,
): Promise<McpGatewayHost> {
  const prepared = await prepareAnalyticsMcpEnv(config);
  for (const reason of prepared.skipped) {
    logger.warn(`Google Analytics вимкнено: ${reason}`);
  }
  const gateway = new McpGateway({
    registry: createPlatformMcpRegistry(),
    servers: folder.manifest.mcp,
    env: prepared.values,
    transport: new StdioMcpTransport(),
    clock,
    telemetry: new OtelMcpTelemetry(metrics.getMeter(SERVICE_NAME), mcpLogger),
  });
  return new McpGatewayHost(gateway, prepared.credentialsFile);
}
