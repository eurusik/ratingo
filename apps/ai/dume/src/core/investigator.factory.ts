import {
  InMemoryRunRepository,
  type AgentFolder,
  type ClockPort,
  type ModelAliases,
  type ModelProviders,
  type RunRepository,
} from '@ratingo/ai-core';

import { AgentRunner } from './agent-runner.service';
import {
  CodeSnapshotPort,
  InvestigationService,
  PatternMatcherPort,
  WorkerPatternMatcher,
} from '../modules/investigation/public';

export interface InvestigatorParts {
  snapshots: CodeSnapshotPort;
  folder: AgentFolder;
  providers: ModelProviders;
  aliases: ModelAliases;
  clock: ClockPort;
  matcher?: PatternMatcherPort;
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
  return new InvestigationService(
    parts.snapshots,
    parts.clock,
    parts.matcher ?? new WorkerPatternMatcher(),
    runner,
    parts.folder,
  );
};
