import type { Tool } from '@ratingo/ai-core';

export interface ExternalTools {
  availableTools(): readonly Tool[];
  expectedToolNames(): readonly string[];
}

export const EXTERNAL_TOOLS = Symbol('EXTERNAL_TOOLS');
