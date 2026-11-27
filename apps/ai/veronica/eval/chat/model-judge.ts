import { z } from 'zod';

import {
  MessageRole,
  ModelError,
  addUsage,
  calculateCostUsd,
  textMessage,
  textOf,
  type ChatMessage,
  type ModelPort,
  type ModelPrice,
  type ModelUsage,
} from '@ratingo/ai-core';

import {
  JUDGE_RESPONSE_NAME,
  JUDGE_SYSTEM_PROMPT,
  JudgeUnavailableError,
  buildJudgePrompt,
  judgeResponseSchema,
  verdictsFromResponse,
  type JudgeInput,
  type JudgePort,
  type JudgeResponse,
  type Judgement,
} from './judge';

const JUDGE_MAX_TOKENS = 1500;
const JUDGE_TIMEOUT_MS = 60_000;
const JSON_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
const REPAIR_PROMPT =
  'Your previous reply was not valid JSON for the required schema. Reply again with only the JSON object.';

const RESPONSE_JSON_SCHEMA = (() => {
  const { $schema: _schemaUri, ...schema } = z.toJSONSchema(judgeResponseSchema) as Record<
    string,
    unknown
  >;
  return schema;
})();

const parseResponse = (text: string): JudgeResponse | null => {
  const trimmed = text.trim();
  try {
    const parsed = judgeResponseSchema.safeParse(
      JSON.parse(JSON_FENCE.exec(trimmed)?.[1] ?? trimmed),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export class ModelJudge implements JudgePort {
  constructor(
    private readonly model: ModelPort,
    private readonly modelName: string,
    private readonly price: ModelPrice,
  ) {}

  async judge(input: JudgeInput): Promise<Judgement> {
    const prompt = textMessage(MessageRole.USER, buildJudgePrompt(input));
    const first = await this.ask([prompt]);
    const firstResponse = parseResponse(first.text);
    if (firstResponse !== null) return this.judgement(input, firstResponse, first.usage);
    const second = await this.ask([
      prompt,
      textMessage(MessageRole.ASSISTANT, first.text),
      textMessage(MessageRole.USER, REPAIR_PROMPT),
    ]);
    const secondResponse = parseResponse(second.text);
    if (secondResponse !== null) {
      return this.judgement(input, secondResponse, addUsage(first.usage, second.usage));
    }
    throw new JudgeUnavailableError('the reply was not valid JSON after one repair attempt');
  }

  private judgement(input: JudgeInput, response: JudgeResponse, usage: ModelUsage): Judgement {
    return {
      verdicts: verdictsFromResponse(input.expectations, response),
      costUsd: calculateCostUsd(usage, this.price),
    };
  }

  private async ask(
    messages: readonly ChatMessage[],
  ): Promise<{ text: string; usage: ModelUsage }> {
    try {
      const response = await this.model.generate({
        model: this.modelName,
        system: JUDGE_SYSTEM_PROMPT,
        messages: [...messages],
        tools: [],
        maxTokens: JUDGE_MAX_TOKENS,
        timeoutMs: JUDGE_TIMEOUT_MS,
        responseSchema: { name: JUDGE_RESPONSE_NAME, jsonSchema: RESPONSE_JSON_SCHEMA },
      });
      return { text: textOf(response.content), usage: response.usage };
    } catch (error) {
      const reason = error instanceof ModelError ? error.category : 'model error';
      throw new JudgeUnavailableError(reason);
    }
  }
}
