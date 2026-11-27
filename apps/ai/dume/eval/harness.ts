import * as path from 'node:path';

import {
  StubModelAdapter,
  SystemClock,
  createModelProviders,
  loadAgentFolder,
  RunTrigger,
  type AgentFolder,
  type ClockPort,
  type ModelProviders,
} from '@ratingo/ai-core';

import { MODEL_ALIAS_NAMES } from '../src/config/models.config';
import { AGENT_FOLDER_PATH } from '../src/core/ai-core.module';
import { createInvestigator } from '../src/core/investigator.factory';
import { createInvestigationStubScript } from '../src/core/stub-investigation.script';
import { DEFAULT_REF } from '../src/modules/investigation/domain/constants/snapshot.constants';
import type { InvestigationOutcome } from '../src/modules/investigation/domain/entities/investigation-outcome';
import { LocalDirectoryCodeSnapshotAdapter } from '../src/modules/investigation/infrastructure/adapters/local-directory.code-snapshot-adapter';
import type { EvalCase } from './eval-case';
import { buildReferenceScript } from './reference-script';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');
const EVAL_EXCLUDED_DIRECTORIES: readonly string[] = ['apps/ai/dume/eval'];
const ANTHROPIC_MAX_RETRIES = 3;
const STUB_PROVIDER = 'stub';

export interface EvalEnvironment {
  modelRef: string;
  structureOnly: boolean;
  snapshots: LocalDirectoryCodeSnapshotAdapter;
  folder: AgentFolder;
  providers: ModelProviders;
  clock: ClockPort;
}

const isStubModel = (modelRef: string): boolean => modelRef.startsWith(`${STUB_PROVIDER}:`);

export const createEvalEnvironment = async (
  modelRef: string,
  anthropicApiKey: string | undefined,
  checkoutRoot: string = REPOSITORY_ROOT,
): Promise<EvalEnvironment> => ({
  modelRef,
  structureOnly: isStubModel(modelRef),
  snapshots: new LocalDirectoryCodeSnapshotAdapter({
    root: checkoutRoot,
    excludedDirectories: EVAL_EXCLUDED_DIRECTORIES,
  }),
  folder: await loadAgentFolder(AGENT_FOLDER_PATH, { knownModelAliases: MODEL_ALIAS_NAMES }),
  providers: createModelProviders({
    stub: new StubModelAdapter(createInvestigationStubScript()),
    anthropicApiKey,
    anthropicMaxRetries: ANTHROPIC_MAX_RETRIES,
  }),
  clock: new SystemClock(),
});

export const runCase = async (
  testCase: EvalCase,
  environment: EvalEnvironment,
): Promise<InvestigationOutcome> => {
  const providers: ModelProviders = environment.structureOnly
    ? {
        [STUB_PROVIDER]: new StubModelAdapter(
          await buildReferenceScript(testCase, await environment.snapshots.resolve(DEFAULT_REF)),
        ),
      }
    : environment.providers;
  const investigator = createInvestigator({
    snapshots: environment.snapshots,
    folder: environment.folder,
    providers,
    aliases: { review: [environment.modelRef] },
    clock: environment.clock,
  });
  return investigator.investigate({
    question: testCase.question,
    ref: DEFAULT_REF,
    trigger: RunTrigger.MANUAL,
    ignoreDailyBudget: true,
  });
};
