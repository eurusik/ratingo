import type { StubScript } from '@ratingo/ai-core';
import { ContentPartType, StopReason, formatModelRef } from '@ratingo/ai-core';

import { STUB_PROVIDER } from '../config/models.config';

const FACTS_PATTERN = /```json\n([\s\S]*?)\n```/;

interface PromptItem {
  id: string;
  level: string;
  advice: string;
}

interface PromptFacts {
  verdict: string;
  items: PromptItem[];
  trends: { label: string; trend: string }[];
}

const HEADLINES: Readonly<Record<string, string>> = {
  action: 'Є справи, які не варто відкладати',
  note: 'Серйозного немає, але є що переглянути',
  ok: 'Усе спокійно, нічого робити не треба',
};

const STUB_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

const readFacts = (prompt: string): PromptFacts | null => {
  const json = FACTS_PATTERN.exec(prompt)?.[1];
  return json === undefined ? null : (JSON.parse(json) as PromptFacts);
};

const interestingLine = (facts: PromptFacts): string | undefined => {
  const changed = facts.trends.find((entry) => entry.trend !== 'так само');
  return changed === undefined
    ? undefined
    : `Порівняно з минулим тижнем змінилось: ${changed.label}.`;
};

export const createDigestStubScript = (): StubScript => ({
  respond: (request) => {
    const prompt = request.messages
      .flatMap((message) => message.content)
      .flatMap((part) => (part.type === ContentPartType.TEXT ? [part.text] : []))
      .join('\n');
    const facts = readFacts(prompt);
    const reply = {
      headline: HEADLINES[facts?.verdict ?? 'ok'],
      actions: (facts?.items ?? [])
        .filter((item) => item.level === 'action')
        .map((item) => ({ id: item.id, text: item.advice })),
      ...(facts === null ? {} : { interesting: interestingLine(facts) }),
    };
    return {
      model: formatModelRef({ provider: STUB_PROVIDER, model: request.model }),
      content: [{ type: ContentPartType.TEXT, text: JSON.stringify(reply) }],
      stopReason: StopReason.END,
      usage: STUB_USAGE,
    };
  },
});
