import {
  AgentLoop,
  FixedClock,
  InMemoryRunRepository,
  NativeToolSource,
  RunTrigger,
  StubModelAdapter,
  ToolRegistry,
  type StubScript,
} from '@ratingo/ai-core';
import { ContentPartType, StopReason, createStubScript, StubScenario } from '@ratingo/ai-core';

import { loadVeronicaAgentFolder } from '../../../../core/agent-folder';

import { buildModelAliases, MODEL_PRICES } from '../../../../config/models.config';
import { createDigestStubScript } from '../../../../core/stub-digest.script';
import { NOW_MS, THRESHOLDS, redSnapshot } from '../../testing/digest.testing';
import { evaluateDigest } from '../../domain/rules/evaluate-digest';

import { DigestTextService, trendOf } from './digest-text.service';

const textScript = (reply: unknown): StubScript => ({
  respond: (request) => ({
    model: `stub:${request.model}`,
    content: [{ type: ContentPartType.TEXT, text: JSON.stringify(reply) }],
    stopReason: StopReason.END,
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    },
  }),
});

const build = async (script: StubScript) => {
  const folder = await loadVeronicaAgentFolder();
  const clock = new FixedClock(NOW_MS);
  const runs = new InMemoryRunRepository();
  const loop = new AgentLoop({
    providers: { stub: new StubModelAdapter(script) },
    registry: await ToolRegistry.create([new NativeToolSource([])], []),
    runs,
    clock,
    prices: MODEL_PRICES,
  });
  return new DigestTextService(
    folder,
    loop,
    clock,
    runs,
    buildModelAliases({ AI_MODEL_FAST: 'stub:digest' }),
  );
};

const digest = () => evaluateDigest(redSnapshot(), THRESHOLDS);

describe('DigestTextService', () => {
  it('turns the stub reply into headline and per-action wording without inventing ids', async () => {
    const service = await build(createDigestStubScript());
    const result = await service.write(digest(), RunTrigger.MANUAL);
    expect(result.text?.headline).toBe('Є справи, які не варто відкладати');
    expect(Object.keys(result.text?.adviceById ?? {}).sort()).toEqual(
      digest()
        .blocks.flatMap((block) => block.items)
        .filter((item) => item.level === 'action')
        .map((item) => item.id)
        .sort(),
    );
    expect(result.costUsd).toBe(0);
    expect(result.runId).not.toBeNull();
  });

  it('drops the whole text when the headline contains a digit', async () => {
    const service = await build(textScript({ headline: 'Три справи', actions: [] }));
    expect((await service.write(digest(), RunTrigger.MANUAL)).text).not.toBeNull();
    const withDigit = await build(textScript({ headline: '3 справи', actions: [] }));
    expect((await withDigit.write(digest(), RunTrigger.MANUAL)).text).toBeNull();
  });

  it('drops action lines with digits or unknown ids and keeps the rest', async () => {
    const service = await build(
      textScript({
        headline: 'Є справи',
        actions: [
          { id: 'api-key:TMDB', text: 'Онови ключ' },
          { id: 'queue-failures:ingestion', text: 'Подивись 55 помилок' },
          { id: 'made-up', text: 'Вигадка' },
        ],
        interesting: 'Користувачів було 14',
      }),
    );
    const { text } = await service.write(digest(), RunTrigger.MANUAL);
    expect(text?.adviceById).toEqual({ 'api-key:TMDB': 'Онови ключ' });
    expect(text?.interesting).toBeUndefined();
  });

  it('returns no text when the model fails, so the template-only fallback is used', async () => {
    const service = await build(createStubScript(StubScenario.TRANSPORT_FAILURE));
    expect(await service.write(digest(), RunTrigger.MANUAL)).toMatchObject({ text: null });
  });

  it('returns no text when the model refuses', async () => {
    const service = await build(createStubScript(StubScenario.REFUSAL));
    expect((await service.write(digest(), RunTrigger.MANUAL)).text).toBeNull();
  });
});

describe('trendOf', () => {
  it('reports missing data as missing, never as a trend', () => {
    expect(trendOf(null, 100)).toBe('немає даних');
    expect(trendOf(null, null)).toBe('немає даних');
  });

  it('calls small and unknown-baseline changes the same', () => {
    expect(trendOf(100, null)).toBe('так само');
    expect(trendOf(110, 100)).toBe('так само');
    expect(trendOf(80, 100)).toBe('так само');
  });

  it('names a trend only for a significant change', () => {
    expect(trendOf(130, 100)).toBe('більше');
    expect(trendOf(60, 100)).toBe('менше');
    expect(trendOf(5, 0)).toBe('більше');
    expect(trendOf(0, 0)).toBe('так само');
  });
});
