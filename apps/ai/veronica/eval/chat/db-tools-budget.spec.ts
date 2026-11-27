import type { Tool } from '@ratingo/ai-core';
import { DB_QUERY_OUTPUT_CAP } from '@ratingo/ai-ops-tools';

import { MODEL_PRICES } from '../../src/config/models.config';
import { loadVeronicaAgentFolder } from '../../src/core/agent-folder';
import { buildInvestigationTools } from '../../src/modules/chat/application/tools/investigation-tools';
import { NO_DELEGATION } from '../../src/modules/chat/application/tools/no-delegation.testing';
import { CHAT_BUDGET_PER_MESSAGE_USD } from '../../src/modules/chat/domain/constants/investigation.constants';

import { EVAL_CASES } from './cases';
import {
  EXPLORER_EVAL_DATABASE_VARIABLE,
  startExplorerEvalDatabase,
  stopExplorerEvalDatabase,
} from './explorer-eval-database';
import { fixtureExecutors } from './harness';

const ADMIN_URL = process.env[EXPLORER_EVAL_DATABASE_VARIABLE];
const describeWithDatabase = ADMIN_URL ? describe : describe.skip;

const HAIKU = 'anthropic:claude-haiku-5-5';
const CHARACTERS_PER_TOKEN = 3;
const TOOL_CALL_TOKENS = 150;
const ANSWER_TOKENS = 250;
const MILLION = 1_000_000;
const HEADROOM = 2;
const SETUP_TIMEOUT_MS = 60_000;

const tokens = (characters: number): number => Math.ceil(characters / CHARACTERS_PER_TOKEN);

describeWithDatabase('a typical run with the database tools, on the real schema', () => {
  beforeAll(async () => {
    await startExplorerEvalDatabase(ADMIN_URL as string);
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await stopExplorerEvalDatabase();
  });

  it('costs less than half of her per-message budget on the smallest model', async () => {
    const testCase = EVAL_CASES.find((current) => current.id === 'db-total-users')!;
    const tools = buildInvestigationTools(fixtureExecutors(testCase), NO_DELEGATION);
    const schemaTool = tools.find((tool: Tool) => tool.name === 'db_schema')!;
    const schemaOutput = await schemaTool.run({}, { runId: 'budget' });
    const folder = await loadVeronicaAgentFolder();
    const prompt = Object.values(folder.prompts).join('\n');
    const definitions = JSON.stringify(tools.map((tool) => tool.definition));
    const base =
      tokens(prompt.length + definitions.length) + tokens('питання про користувачів'.length);
    const afterSchema = base + TOOL_CALL_TOKENS + tokens(schemaOutput.length);
    const afterQuery = afterSchema + TOOL_CALL_TOKENS + tokens(DB_QUERY_OUTPUT_CAP);
    const inputTokens = base + afterSchema + afterQuery;
    const outputTokens = 2 * TOOL_CALL_TOKENS + ANSWER_TOKENS;
    const price = MODEL_PRICES[HAIKU];

    const costUsd =
      (inputTokens * price.inputPerMTokUsd + outputTokens * price.outputPerMTokUsd) / MILLION;

    expect(costUsd).toBeLessThan(CHAT_BUDGET_PER_MESSAGE_USD / HEADROOM);
  });
});
