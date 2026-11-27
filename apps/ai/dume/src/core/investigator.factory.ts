import {
  InMemoryRunRepository,
  type AgentFolder,
  type ClockPort,
  type ModelAliases,
  type ModelProviders,
  type RunRepository,
} from '@ratingo/ai-core';

import { InvestigationService } from '../modules/investigation/public';
import type { CodeSnapshotPort } from '../modules/investigation/domain/ports/code-snapshot.port';
import { AgentRunner } from './agent-runner.service';

export interface InvestigatorParts {
  snapshots: CodeSnapshotPort;
  folder: AgentFolder;
  providers: ModelProviders;
  aliases: ModelAliases;
  clock: ClockPort;
  runs?: RunRepository;
}

export const createInvestigator = (parts: InvestigatorParts): InvestigationService => {
  const runner = new AgentRunner(
    parts.folder,
    parts.providers,
    parts.aliases,
    parts.runs ?? new InMemoryRunRepository(),
    parts.clock,
  );
  return new InvestigationService(parts.snapshots, parts.clock, runner, parts.folder);
};
