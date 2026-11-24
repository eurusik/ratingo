import type { McpGateway, Tool } from '@ratingo/ai-core';

import { McpGatewayHost } from './mcp-gateway.host';
import type { PrivateCredentialsFile } from './private-credentials-file';

const GA_TOOL = { name: 'google-analytics__run_report' } as Tool;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const gatewayListing = (listTools: () => Promise<readonly Tool[]>) =>
  ({
    toolSource: () => ({ listTools }),
    expectedToolNames: () => [GA_TOOL.name],
    close: async () => undefined,
  }) as unknown as McpGateway;

describe('McpGatewayHost', () => {
  it('answers at once while the server is still starting, then offers the tools', async () => {
    const listing = deferred<readonly Tool[]>();
    const host = new McpGatewayHost(gatewayListing(() => listing.promise));

    host.onApplicationBootstrap();
    expect(host.availableTools()).toEqual([]);

    listing.resolve([GA_TOOL]);
    await host.warmUp();

    expect(host.availableTools()).toEqual([GA_TOOL]);
  });

  it('starts one listing for many runs and retries after a failed one', async () => {
    const listTools = jest
      .fn<Promise<readonly Tool[]>, []>()
      .mockRejectedValueOnce(new Error('server down'))
      .mockResolvedValue([GA_TOOL]);
    const host = new McpGatewayHost(gatewayListing(listTools));

    host.availableTools();
    host.availableTools();
    await host.warmUp();
    expect(listTools).toHaveBeenCalledTimes(1);
    expect(host.availableTools()).toEqual([]);

    await host.warmUp();
    expect(host.availableTools()).toEqual([GA_TOOL]);
  });

  it('closes the gateway and then removes the key file on shutdown', async () => {
    const order: string[] = [];
    const gateway = {
      ...gatewayListing(async () => []),
      close: async () => void order.push('close'),
    } as unknown as McpGateway;
    const file = {
      remove: async () => void order.push('remove'),
    } as unknown as PrivateCredentialsFile;

    await new McpGatewayHost(gateway, file).onApplicationShutdown();

    expect(order).toEqual(['close', 'remove']);
  });
});
