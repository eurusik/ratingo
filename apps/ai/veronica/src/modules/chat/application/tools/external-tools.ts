import type { Tool } from '@ratingo/ai-core';

export interface ExternalTools {
  listTools(): Promise<readonly Tool[]>;
  expectedToolNames(): readonly string[];
}

export const EXTERNAL_TOOLS = Symbol('EXTERNAL_TOOLS');
