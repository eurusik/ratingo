import type { AgentLoop, ToolRegistry } from '@ratingo/ai-core';

export const AGENT_FOLDER = Symbol('AGENT_FOLDER');
export const AGENT_LOOP = Symbol('AGENT_LOOP');
export const MODEL_PROVIDERS = Symbol('MODEL_PROVIDERS');
export const AGENT_LOOP_FACTORY = Symbol('AGENT_LOOP_FACTORY');

export type AgentLoopFactory = (registry: ToolRegistry) => AgentLoop;
