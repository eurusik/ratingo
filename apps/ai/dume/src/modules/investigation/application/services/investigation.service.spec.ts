import {
  ContentPartType,
  FixedClock,
  InMemoryRunRepository,
  RunStopReason,
  RunTrigger,
  StopReason,
  StubModelAdapter,
  formatModelRef,
  loadAgentFolder,
  type ModelRequest,
  type ModelResponse,
  type StubScript,
} from '@ratingo/ai-core';
import { Logger } from '@nestjs/common';

import { createInvestigator } from '../../../../core/investigator.factory';
import { AGENT_FOLDER_PATH } from '../../../../core/ai-core.module';
import { InvalidQuestionError } from '../../domain/errors/invalid-question.error';
import { SnapshotFailure, SnapshotUnavailableError } from '../../domain/errors/investigation.errors';
import { AnswerSupport, AssumptionOrigin, CitationFailure } from '../../domain/entities/investigation-answer';
import { InvestigationStatus } from '../../domain/entities/investigation-outcome';
import { inMemorySnapshot, TEST_SHA } from '../../infrastructure/testing/in-memory-snapshot.testing';
import type { CodeSnapshotPort } from '../../domain/ports/code-snapshot.port';
import { MAX_QUESTION_CHARS } from '../../investigation.constants';

const USAGE = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };

type Step = { tool: string; input: unknown } | { answer: unknown };

const scripted = (steps: readonly Step[]): StubScript => ({
  respond: (request: ModelRequest, callIndex: number): ModelResponse => {
    const step = steps[Math.min(callIndex, steps.length - 1)] as Step;
    const model = formatModelRef({ provider: 'stub', model: request.model });
    return 'tool' in step
      ? {
          model,
          stopReason: StopReason.TOOL_USE,
          usage: USAGE,
          content: [{ type: ContentPartType.TOOL_CALL, call: { id: `call-${callIndex}`, name: step.tool, input: step.input } }],
        }
      : {
          model,
          stopReason: StopReason.END,
          usage: USAGE,
          content: [{ type: ContentPartType.TEXT, text: JSON.stringify(step.answer) }],
        };
  },
});

const FILES = {
  'apps/api/worker.ts': "line one\nworker.on('failed', handler);\nline three\nline four\n",
};

const build = async (steps: readonly Step[], snapshots?: CodeSnapshotPort) => {
  const folder = await loadAgentFolder(AGENT_FOLDER_PATH, { knownModelAliases: ['review'] });
  const model = new StubModelAdapter(scripted(steps));
  const runs = new InMemoryRunRepository();
  const snapshot = inMemorySnapshot(FILES);
  const service = createInvestigator({
    snapshots: snapshots ?? { resolve: () => Promise.resolve(snapshot) },
    folder,
    providers: { stub: model },
    aliases: { review: ['stub:review'] },
    clock: new FixedClock(1_000),
    runs,
  });
  return { service, model, runs };
};

const ask = (service: Awaited<ReturnType<typeof build>>['service'], question = 'Why does the worker mark jobs failed?') =>
  service.investigate({ question, ref: 'main', trigger: RunTrigger.MANUAL, ignoreDailyBudget: true });

describe('InvestigationService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('returns facts whose citations were read in this run', async () => {
    const { service } = await build([
      { tool: 'code_read', input: { path: 'apps/api/worker.ts', startLine: 1, endLine: 3 } },
      {
        answer: {
          answer: 'Воркер позначає збій.',
          claims: [{ text: 'worker reacts to failed', citations: [{ path: 'apps/api/worker.ts', startLine: 2, endLine: 2 }] }],
          assumptions: [],
          unknowns: [],
        },
      },
    ]);

    const outcome = await ask(service);

    expect(outcome).toMatchObject({ status: InvestigationStatus.ANSWERED, commit: TEST_SHA, turns: 2, stopReason: RunStopReason.END });
    expect(outcome.answer?.support).toBe(AnswerSupport.SUPPORTED);
    expect(outcome.answer?.facts).toHaveLength(1);
    expect(outcome.pathsRead).toEqual(['apps/api/worker.ts']);
    expect(outcome.toolCalls).toEqual({ code_read: 1 });
  });

  it('moves a claim citing lines nobody read to the assumptions', async () => {
    const { service } = await build([
      { tool: 'code_read', input: { path: 'apps/api/worker.ts', startLine: 1, endLine: 2 } },
      {
        answer: {
          answer: 'Так.',
          claims: [{ text: 'line four does things', citations: [{ path: 'apps/api/worker.ts', startLine: 4, endLine: 4 }] }],
          assumptions: [],
          unknowns: [],
        },
      },
    ]);

    const outcome = await ask(service);

    expect(outcome.answer?.facts).toEqual([]);
    expect(outcome.answer?.support).toBe(AnswerSupport.UNSUPPORTED);
    expect(outcome.answer?.assumptions[0]).toMatchObject({
      origin: AssumptionOrigin.UNVERIFIED_CLAIM,
      problems: [{ failure: CitationFailure.NOT_READ_IN_THIS_RUN }],
    });
  });

  it('accepts an honest unknown with nothing cited', async () => {
    const { service } = await build([
      { tool: 'code_search', input: { pattern: 'nothing like this' } },
      { answer: { answer: 'У коді цього немає.', claims: [], assumptions: [], unknowns: ['Шукано "nothing like this", збігів немає.'] } },
    ]);

    const outcome = await ask(service);

    expect(outcome.status).toBe(InvestigationStatus.ANSWERED);
    expect(outcome.answer?.support).toBe(AnswerSupport.NO_CLAIMS);
    expect(outcome.answer?.unknowns).toHaveLength(1);
  });

  it('does not run the same empty search twice and still finishes', async () => {
    const { service, model } = await build([
      { tool: 'code_search', input: { pattern: 'absent' } },
      { tool: 'code_search', input: { pattern: 'absent' } },
      { answer: { answer: 'Нічого.', claims: [], assumptions: [], unknowns: ['absent'] } },
    ]);

    const outcome = await ask(service);
    const lastRequest = model.requests[model.requests.length - 1] as ModelRequest;
    const results = lastRequest.messages.flatMap((message) => message.content).flatMap((part) => (part.type === ContentPartType.TOOL_RESULT ? [part.result.content] : []));

    expect(outcome.turns).toBe(3);
    expect(results[1]).toContain('already returned nothing');
  });

  it('turns a failed tool into an answer for the model instead of an exception', async () => {
    const { service } = await build([
      { tool: 'code_read', input: { path: 'apps/api/missing.ts' } },
      { answer: { answer: 'Файлу немає.', claims: [], assumptions: [], unknowns: ['файл відсутній'] } },
    ]);

    const outcome = await ask(service);

    expect(outcome.status).toBe(InvestigationStatus.ANSWERED);
  });

  it('reports a run that never produced a valid answer as unanswered', async () => {
    const { service } = await build([{ answer: { nonsense: true } }]);

    const outcome = await ask(service);

    expect(outcome).toMatchObject({ status: InvestigationStatus.UNANSWERED, answer: null, stopReason: RunStopReason.INVALID_OUTPUT });
  });

  it('stops at the turn limit when the model keeps calling tools', async () => {
    const { service } = await build([{ tool: 'code_list', input: { path: '' } }]);

    const outcome = await ask(service);

    expect(outcome).toMatchObject({ status: InvestigationStatus.UNANSWERED, stopReason: RunStopReason.MAX_TURNS });
  });

  it('reports an unavailable snapshot with its reason and never calls the model', async () => {
    const { service, model } = await build([{ answer: {} }], {
      resolve: () => Promise.reject(new SnapshotUnavailableError(SnapshotFailure.RATE_LIMITED)),
    });

    const outcome = await ask(service);

    expect(outcome).toMatchObject({ status: InvestigationStatus.SNAPSHOT_UNAVAILABLE, snapshotFailure: SnapshotFailure.RATE_LIMITED });
    expect(model.requests).toHaveLength(0);
  });

  it('rejects an empty or oversized question before any work', async () => {
    const { service, model } = await build([{ answer: {} }]);

    await expect(ask(service, '   ')).rejects.toBeInstanceOf(InvalidQuestionError);
    await expect(ask(service, 'x'.repeat(MAX_QUESTION_CHARS + 1))).rejects.toBeInstanceOf(InvalidQuestionError);
    expect(model.requests).toHaveLength(0);
  });

  it('offers exactly the three read-only tools and tells the model the commit', async () => {
    const { service, model } = await build([{ answer: { answer: 'x', claims: [], assumptions: [], unknowns: [] } }]);

    await ask(service);
    const request = model.requests[0] as ModelRequest;

    expect(request.tools.map((tool) => tool.name)).toEqual(['code_search', 'code_read', 'code_list']);
    expect(JSON.stringify(request.messages)).toContain(TEST_SHA);
    expect(request.system).toContain('<untrusted>');
  });
});
