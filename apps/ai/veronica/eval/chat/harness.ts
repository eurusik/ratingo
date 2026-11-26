import {
  AgentLoop,
  FixedClock,
  InMemoryRunRepository,
  McpGateway,
  StubModelAdapter,
  GoogleAnalyticsMcpKey,
  assertAliasProvidersRegistered,
  createModelProviders,
  createPlatformMcpRegistry,
  type AgentFolder,
  type ClockPort,
  type ModelAliases,
} from '@ratingo/ai-core';

import { MODEL_PRICES } from '../../src/config/models.config';
import { loadVeronicaAgentFolder } from '../../src/core/agent-folder';
import { InvestigationRunner } from '../../src/modules/chat/application/services/investigation.runner';
import type { InvestigationExecutors } from '../../src/modules/chat/application/tools/investigation-executors';
import { JobFailuresExecutor } from '../../src/modules/chat/application/tools/job-failures.executor';
import type { ChatOutcome } from '../../src/modules/chat/domain/constants/chat.constants';
import type { ConversationTurn } from '../../src/modules/chat/domain/entities/conversation-turn';
import { withoutFlaggedNote } from '../../src/modules/chat/domain/policies/flagged-numbers.policy';
import {
  answerStep,
  callStep,
  scriptedModel,
} from '../../src/modules/chat/testing/scripted-model.testing';

import type { ExternalTools } from '../../src/modules/chat/application/tools/external-tools';

import { callKey, type EvalCase, type Fixture } from './eval-case';
import { EVAL_NOW_MS } from './eval-clock';
import {
  GA_SERVER,
  SimulatedGaConnection,
  simulatedGaTransport,
} from './google-analytics.fake-server';
import type { CaseResult } from './scorer';

const CHAT_ID = 'eval';
const SNAPSHOT_STUB_HTML = 'SNAPSHOT';
const EVAL_GA_ENV = {
  [GoogleAnalyticsMcpKey.CREDENTIALS_FILE]: '/eval/no-key.json',
  [GoogleAnalyticsMcpKey.PROPERTY_ID]: '515589933',
};
const SILENT_TELEMETRY = { callFinished: () => undefined, serverEvent: () => undefined };

const fixtureGaTools = async (testCase: EvalCase, clock: ClockPort): Promise<ExternalTools> => {
  const gateway = new McpGateway({
    registry: createPlatformMcpRegistry(),
    servers: [GA_SERVER],
    env: EVAL_GA_ENV,
    transport: simulatedGaTransport(new SimulatedGaConnection(testCase.fixtures)),
    clock,
    telemetry: SILENT_TELEMETRY,
  });
  const tools = await gateway.toolSource().listTools();
  return {
    availableTools: () => tools,
    expectedToolNames: () => gateway.expectedToolNames(),
  };
};

const NO_RECORDED_FAILURES = new JobFailuresExecutor(
  { since: async () => [] },
  new FixedClock(EVAL_NOW_MS),
);

const matches = (fixture: Fixture, input: unknown): boolean =>
  Object.entries(fixture.match ?? {}).every(
    ([key, value]) => (input as Record<string, unknown> | null)?.[key] === value,
  );

export const fixtureExecutors = (testCase: EvalCase): InvestigationExecutors => {
  const answer = (tool: string) => async (input?: unknown) => {
    const fixture = testCase.fixtures.find((entry) => entry.tool === tool && matches(entry, input));
    if (fixture === undefined) {
      throw new Error(`No fixture for ${callKey(tool, input)} in case ${testCase.id}`);
    }
    if (fixture.error !== undefined) {
      throw new Error(fixture.error);
    }
    return fixture.response;
  };
  return {
    metricsQuery: answer('metrics_query'),
    productStats: answer('product_stats'),
    digestSnapshot: () => answer('digest_snapshot')(),
    recentChanges: answer('recent_changes'),
    askHappy: answer('ask_happy'),
    jobFailures: testCase.fixtures.some((entry) => entry.tool === 'job_failures')
      ? answer('job_failures')
      : (input) => NO_RECORDED_FAILURES.run(input),
  };
};

export interface EvalRunResult {
  result: CaseResult;
  costUsd: number;
}

export interface EvalSetup {
  modelRef: string;
  anthropicApiKey?: string;
}

export const isStubModel = (modelRef: string): boolean => modelRef.startsWith('stub:');

export const runCase = async (
  testCase: EvalCase,
  setup: EvalSetup,
  folder?: AgentFolder,
): Promise<EvalRunResult> => {
  const loaded = folder ?? (await loadVeronicaAgentFolder());
  const reference = scriptedModel([
    ...testCase.reference.calls.map((call) => callStep(call.tool, call.input)),
    answerStep(testCase.reference.answer),
  ]);
  const providers = createModelProviders({
    stub: new StubModelAdapter(reference),
    anthropicApiKey: setup.anthropicApiKey,
  });
  const clock = new FixedClock(EVAL_NOW_MS);
  const runs = new InMemoryRunRepository();
  const aliases: ModelAliases = { fast: [setup.modelRef] };
  assertAliasProvidersRegistered(aliases, providers);
  const finalHtml: string[] = [];
  const history: ConversationTurn[] = [...(testCase.history ?? [])];
  const runner = new InvestigationRunner(
    fixtureExecutors(testCase),
    (registry) => new AgentLoop({ providers, registry, runs, clock, prices: MODEL_PRICES }),
    loaded,
    clock,
    runs,
    aliases,
    { recent: async () => history, append: async () => undefined },
    {
      postMessage: async () => 1,
      editMessage: async (_chatId, _messageId, html) => void finalHtml.push(html),
      sendMessage: async (_chatId, html) => void finalHtml.push(html),
      sendChatAction: async () => undefined,
    },
    { status: async () => ({ html: SNAPSHOT_STUB_HTML, silent: true }) } as never,
    await fixtureGaTools(testCase, clock),
  );
  const outcome = await runner.answer(CHAT_ID, testCase.question);
  return {
    costUsd: outcome.costUsd,
    result: {
      caseId: testCase.id,
      calledKeys: outcome.toolCalls.map((call) => callKey(call.tool, call.input)),
      answer: withoutFlaggedNote(finalHtml[finalHtml.length - 1] ?? ''),
      outcome: outcome.outcome as ChatOutcome,
      flaggedNumbers: outcome.unverifiedNumbers,
      rawModelOutput: outcome.rawModelOutput,
    },
  };
};
