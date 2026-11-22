import { Inject, Injectable } from '@nestjs/common';

import { HappyLookupKind } from '../../domain/entities/happy';
import { clip, stripLinks } from '../../domain/policies/answer-sanitizer.policy';
import { HAPPY_CLIENT, type HappyClientPort } from '../../domain/ports/happy-client.port';

import type { AskHappyInput } from './investigation-executors';

const QUESTION_CHARS = 200;
const SUMMARY_CHARS = 500;

const clean = (text: string, limit: number): string => clip(stripLinks(text), limit);

@Injectable()
export class AskHappyExecutor {
  constructor(@Inject(HAPPY_CLIENT) private readonly happy: HappyClientPort) {}

  async run(input: AskHappyInput): Promise<unknown> {
    const lookup = await this.happy.latestResult(input.pull_number);
    if (lookup.kind === HappyLookupKind.NOT_FOUND) {
      return { pullRequest: input.pull_number, found: false };
    }
    const { result } = lookup;
    return {
      pullRequest: input.pull_number,
      found: true,
      reviewRunningNow: lookup.reviewPending,
      reviewed: result !== null,
      ...(result === null
        ? {}
        : {
            status: result.status,
            forCurrentCommit: result.current,
            verdict: clean(result.title, QUESTION_CHARS),
            summary: clean(result.summary, SUMMARY_CHARS),
            skipReason: result.skipReason,
            findingsBySeverity: result.counts,
            questions: result.questions.map((question) => ({
              where: `${clip(question.file, 80)}:${question.line}`,
              text: clean(question.text, QUESTION_CHARS),
            })),
            coverage: result.coverage,
          }),
    };
  }
}
