import type { McpGateway } from '@ratingo/ai-core';

import { McpGatewayHost } from './mcp-gateway.host';
import type { PrivateCredentialsFile } from './private-credentials-file';

describe('McpGatewayHost', () => {
  it('closes the gateway and then removes the key file on shutdown', async () => {
    const order: string[] = [];
    const gateway = { close: async () => void order.push('close') } as unknown as McpGateway;
    const file = {
      remove: async () => void order.push('remove'),
    } as unknown as PrivateCredentialsFile;

    await new McpGatewayHost(gateway, file).onApplicationShutdown();

    expect(order).toEqual(['close', 'remove']);
  });

  it('passes the tool listing and the expected names through', async () => {
    const gateway = {
      toolSource: () => ({ listTools: async () => [] }),
      expectedToolNames: () => ['google-analytics__run_report'],
    } as unknown as McpGateway;
    const host = new McpGatewayHost(gateway);

    await expect(host.listTools()).resolves.toEqual([]);
    expect(host.expectedToolNames()).toEqual(['google-analytics__run_report']);
  });
});
