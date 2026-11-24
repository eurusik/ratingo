import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import type { McpGateway, Tool } from '@ratingo/ai-core';

import type { PrivateCredentialsFile } from './private-credentials-file';

export class McpGatewayHost implements OnApplicationBootstrap, OnApplicationShutdown {
  private ready: readonly Tool[] = [];
  private warming: Promise<void> | undefined;

  constructor(
    private readonly gateway: McpGateway,
    private readonly credentialsFile?: PrivateCredentialsFile,
  ) {}

  onApplicationBootstrap(): void {
    void this.warmUp();
  }

  availableTools(): readonly Tool[] {
    if (this.ready.length === 0) {
      void this.warmUp();
    }
    return this.ready;
  }

  expectedToolNames(): readonly string[] {
    return this.gateway.expectedToolNames();
  }

  warmUp(): Promise<void> {
    this.warming ??= this.gateway
      .toolSource()
      .listTools()
      .then((tools) => {
        this.ready = tools;
      })
      .catch(() => undefined)
      .finally(() => {
        this.warming = undefined;
      });
    return this.warming;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.gateway.close();
    await this.credentialsFile?.remove();
  }
}
