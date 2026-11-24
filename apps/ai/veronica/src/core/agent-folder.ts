import * as path from 'node:path';

import { createPlatformMcpRegistry, loadAgentFolder, type AgentFolder } from '@ratingo/ai-core';

import { MODEL_ALIAS_NAMES } from '../config/models.config';

const VERONICA_AGENT_PATH = path.resolve(__dirname, '../../agent');

export const loadVeronicaAgentFolder = (): Promise<AgentFolder> =>
  loadAgentFolder(VERONICA_AGENT_PATH, {
    knownModelAliases: MODEL_ALIAS_NAMES,
    knownMcpServers: createPlatformMcpRegistry().names(),
  });
