import type { StubScript } from '@ratingo/ai-core';

import { createChatStubScript } from './stub-chat.script';
import { createDigestStubScript } from './stub-digest.script';

export const createStubScript = (): StubScript => {
  const digest = createDigestStubScript();
  const chat = createChatStubScript();
  return {
    respond: (request, callIndex) =>
      request.tools.length > 0
        ? chat.respond(request, callIndex)
        : digest.respond(request, callIndex),
  };
};
