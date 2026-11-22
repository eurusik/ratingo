import type { Tool } from './define-tool';

export interface ToolSource {
  listTools(): Promise<readonly Tool[]>;
}

export const TOOL_SOURCE_PORT = Symbol('TOOL_SOURCE_PORT');
