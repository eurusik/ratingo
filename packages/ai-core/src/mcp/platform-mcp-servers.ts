import type { McpServerDefinition } from './mcp-server.definition';
import { McpServerRegistry } from './mcp-server.registry';
import { GOOGLE_ANALYTICS_MCP_SERVER } from './servers/google-analytics.mcp-server';

export const PLATFORM_MCP_SERVERS: readonly McpServerDefinition[] = [GOOGLE_ANALYTICS_MCP_SERVER];

export function createPlatformMcpRegistry(): McpServerRegistry {
  return new McpServerRegistry(PLATFORM_MCP_SERVERS);
}
