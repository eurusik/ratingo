import type { StubScript } from '@ratingo/ai-core';
import { ContentPartType, StopReason, formatModelRef } from '@ratingo/ai-core';

import { STUB_PROVIDER } from '../config/models.config';

const FILES_PATTERN = /```json\n([\s\S]*?)\n```/;
const FINDINGS_PROPERTY = 'findings';

const STUB_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

const changedPaths = (prompt: string): string[] => {
  const json = FILES_PATTERN.exec(prompt)?.[1];
  if (json === undefined) return [];
  const parsed = JSON.parse(json) as { files?: { path: string }[] };
  return (parsed.files ?? []).map((file) => file.path);
};

const isReviewRequest = (schema: Record<string, unknown> | undefined): boolean =>
  JSON.stringify(schema ?? {}).includes(`"${FINDINGS_PROPERTY}"`);

export const createReviewStubScript = (): StubScript => ({
  respond: (request) => {
    const prompt = request.messages
      .flatMap((message) => message.content)
      .flatMap((part) => (part.type === ContentPartType.TEXT ? [part.text] : []))
      .join('\n');
    const reply = isReviewRequest(request.responseSchema?.jsonSchema)
      ? { summary: 'Stub review: no model was called, so nothing was checked.', findings: [] }
      : { risk: 'low', focusFiles: changedPaths(prompt), ruleTopics: [] };
    return {
      model: formatModelRef({ provider: STUB_PROVIDER, model: request.model }),
      content: [{ type: ContentPartType.TEXT, text: JSON.stringify(reply) }],
      stopReason: StopReason.END,
      usage: STUB_USAGE,
    };
  },
});
