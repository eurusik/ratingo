const MCP_TOOL_SEPARATOR = '__';
export const MCP_SERVER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const MCP_REMOTE_TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
export const MAX_BRIDGED_TOOL_NAME_LENGTH = 64;

export interface McpToolAddress {
  server: string;
  tool: string;
}

export class InvalidMcpToolNameError extends Error {
  constructor(name: string, reason: string) {
    super(`Invalid MCP tool name "${name}": ${reason}`);
    this.name = 'InvalidMcpToolNameError';
  }
}

export function isValidMcpServerName(server: string): boolean {
  return MCP_SERVER_NAME_PATTERN.test(server);
}

export function canBridgeMcpTool(address: McpToolAddress): boolean {
  return (
    isValidMcpServerName(address.server) &&
    MCP_REMOTE_TOOL_NAME_PATTERN.test(address.tool) &&
    address.server.length + MCP_TOOL_SEPARATOR.length + address.tool.length <=
      MAX_BRIDGED_TOOL_NAME_LENGTH
  );
}

export function toBridgedToolName(address: McpToolAddress): string {
  const name = `${address.server}${MCP_TOOL_SEPARATOR}${address.tool}`;
  if (!canBridgeMcpTool(address)) {
    throw new InvalidMcpToolNameError(
      name,
      `server must match ${MCP_SERVER_NAME_PATTERN.source}, tool must match ${MCP_REMOTE_TOOL_NAME_PATTERN.source} and the whole name must fit ${MAX_BRIDGED_TOOL_NAME_LENGTH} characters`,
    );
  }
  return name;
}

export function parseBridgedToolName(name: string): McpToolAddress | undefined {
  const separatorAt = name.indexOf(MCP_TOOL_SEPARATOR);
  if (separatorAt <= 0) {
    return undefined;
  }
  const address = {
    server: name.slice(0, separatorAt),
    tool: name.slice(separatorAt + MCP_TOOL_SEPARATOR.length),
  };
  return canBridgeMcpTool(address) ? address : undefined;
}
