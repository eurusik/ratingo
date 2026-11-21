import type { Tool } from '../define-tool';
import type { ToolSource } from '../tool-source.port';

export class NativeToolSource implements ToolSource {
  constructor(private readonly tools: readonly Tool[]) {}

  async listTools(): Promise<readonly Tool[]> {
    return this.tools;
  }
}
