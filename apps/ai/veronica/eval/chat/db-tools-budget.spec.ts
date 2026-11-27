import { DB_QUERY_OUTPUT_CAP, DB_SCHEMA_OUTPUT_CAP } from '@ratingo/ai-ops-tools';

import { MODEL_PRICES } from '../../src/config/models.config';
import { loadVeronicaAgentFolder } from '../../src/core/agent-folder';
import { buildInvestigationTools } from '../../src/modules/chat/application/tools/investigation-tools';
import { NO_DELEGATION } from '../../src/modules/chat/application/tools/no-delegation.testing';
import { CHAT_BUDGET_PER_MESSAGE_USD } from '../../src/modules/chat/domain/constants/investigation.constants';

import { EVAL_CASES } from './cases';
import { fixtureExecutors } from './harness';

const HAIKU = 'anthropic:claude-haiku-5-5';
const CHARACTERS_PER_TOKEN = 3;
const TOOL_CALL_TOKENS = 150;
const ANSWER_TOKENS = 250;
const MILLION = 1_000_000;
const HEADROOM = 2;

const tokens = (characters: number): number => Math.ceil(characters / CHARACTERS_PER_TOKEN);

describe('a typical run with the database tools, at the largest output the tools may return', () => {
  it('costs less than half of her per-message budget on the smallest model', async () => {
    const testCase = EVAL_CASES.find((current) => current.id === 'db-not-configured')!;
    const tools = buildInvestigationTools(fixtureExecutors(testCase), NO_DELEGATION);
    const folder = await loadVeronicaAgentFolder();
    const prompt = Object.values(folder.prompts).join('\n');
    const definitions = JSON.stringify(tools.map((tool) => tool.definition));
    const base =
      tokens(prompt.length + definitions.length) + tokens('питання про користувачів'.length);
    const afterSchema = base + TOOL_CALL_TOKENS + tokens(DB_SCHEMA_OUTPUT_CAP);
    const afterQuery = afterSchema + TOOL_CALL_TOKENS + tokens(DB_QUERY_OUTPUT_CAP);
    const inputTokens = base + afterSchema + afterQuery;
    const outputTokens = 2 * TOOL_CALL_TOKENS + ANSWER_TOKENS;
    const price = MODEL_PRICES[HAIKU];

    const costUsd =
      (inputTokens * price.inputPerMTokUsd + outputTokens * price.outputPerMTokUsd) / MILLION;

    expect(costUsd).toBeLessThan(CHAT_BUDGET_PER_MESSAGE_USD / HEADROOM);
  });
});
