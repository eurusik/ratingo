import * as fc from 'fast-check';
import {
  InvalidMcpToolNameError,
  MAX_BRIDGED_TOOL_NAME_LENGTH,
  canBridgeMcpTool,
  parseBridgedToolName,
  toBridgedToolName,
} from './mcp-tool-name';
import type { McpToolAddress } from './mcp-tool-name';

const serverName = fc.stringMatching(/^[a-z][a-z0-9-]{0,11}$/);
const toolName = fc.stringMatching(/^[A-Za-z0-9_-]{1,40}$/);
const address = fc
  .record({ server: serverName, tool: toolName })
  .filter((candidate: McpToolAddress) => canBridgeMcpTool(candidate));

describe('bridged MCP tool names', () => {
  it('round-trips every bridgeable address', () => {
    fc.assert(
      fc.property(address, (value) => {
        expect(parseBridgedToolName(toBridgedToolName(value))).toEqual(value);
      }),
    );
  });

  it('never gives two different addresses the same name', () => {
    fc.assert(
      fc.property(address, address, (left, right) => {
        const same = left.server === right.server && left.tool === right.tool;
        expect(toBridgedToolName(left) === toBridgedToolName(right)).toBe(same);
      }),
    );
  });

  it('prefixes the tool with the server', () => {
    expect(toBridgedToolName({ server: 'ga', tool: 'run_report' })).toBe('ga__run_report');
  });

  it('keeps tool names that contain the separator reversible', () => {
    expect(parseBridgedToolName('ga___hidden__tool')).toEqual({
      server: 'ga',
      tool: '_hidden__tool',
    });
  });

  it.each([
    [{ server: 'Ga', tool: 'x' }],
    [{ server: 'g_a', tool: 'x' }],
    [{ server: 'ga', tool: 'run.report' }],
    [{ server: 'ga', tool: 'x'.repeat(MAX_BRIDGED_TOOL_NAME_LENGTH) }],
  ])('rejects %j', (value) => {
    expect(() => toBridgedToolName(value)).toThrow(InvalidMcpToolNameError);
  });

  it('does not parse names without a server prefix', () => {
    expect(parseBridgedToolName('product_stats')).toBeUndefined();
    expect(parseBridgedToolName('__tool')).toBeUndefined();
  });
});
