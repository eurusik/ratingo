import type { OnApplicationShutdown } from '@nestjs/common';

import type { McpGateway, Tool } from '@ratingo/ai-core';

import type { PrivateCredentialsFile } from './private-credentials-file';

export class McpGatewayHost implements OnApplicationShutdown {
  constructor(
    private readonly gateway: McpGateway,
    private readonly credentialsFile?: PrivateCredentialsFile,
  ) {}

  listTools(): Promise<readonly Tool[]> {
    return this.gateway.toolSource().listTools();
  }

  expectedToolNames(): readonly string[] {
    return this.gateway.expectedToolNames();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.gateway.close();
    await this.credentialsFile?.remove();
  }
}
