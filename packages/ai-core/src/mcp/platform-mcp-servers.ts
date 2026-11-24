import type { McpServerDefinition } from './mcp-server.definition';
import { McpServerRegistry } from './mcp-server.registry';

export const PLATFORM_MCP_SERVERS: readonly McpServerDefinition[] = [];

export function createPlatformMcpRegistry(): McpServerRegistry {
  return new McpServerRegistry(PLATFORM_MCP_SERVERS);
}
