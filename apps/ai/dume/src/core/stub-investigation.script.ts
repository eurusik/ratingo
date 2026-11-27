import type { StubScript } from '@ratingo/ai-core';
import { ContentPartType, StopReason, formatModelRef } from '@ratingo/ai-core';

import { STUB_PROVIDER } from '../config/models.config';

const STUB_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

const STUB_ANSWER = {
  answer: 'Stub investigation: no model was called, so nothing was checked.',
  claims: [],
  assumptions: [],
  unknowns: ['No model was called.'],
};

export const createInvestigationStubScript = (): StubScript => ({
  respond: (request) => ({
    model: formatModelRef({ provider: STUB_PROVIDER, model: request.model }),
    content: [{ type: ContentPartType.TEXT, text: JSON.stringify(STUB_ANSWER) }],
    stopReason: StopReason.END,
    usage: STUB_USAGE,
  }),
});
