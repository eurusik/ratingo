import { z } from 'zod';

import {
  MAX_RESULT_MARKER_CHARS,
  MAX_RESULT_QUESTIONS,
  MAX_RESULT_QUESTION_CHARS,
  MAX_RESULT_SUMMARY_CHARS,
  MAX_RESULT_TITLE_CHARS,
  RESULT_MARKER_VERSION,
} from '../../domain/constants/review-limits.constants';
import { SEVERITY_ORDER } from '../../domain/constants/severity.constants';
import { CoverageGap, ReviewStatus } from '../../domain/entities/review-outcome';
import type { ReviewResultSnapshot } from '../../domain/entities/review-result';
import { RESULT_MARKER_PREFIX } from '../../domain/policies/review-result';

const MARKER_PATTERN = new RegExp(
  `${RESULT_MARKER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${RESULT_MARKER_VERSION} ([^\\s>]+) -->`,
);

const count = z.number().int().min(0).max(1_000);

const snapshotSchema = z.object({
  status: z.enum(Object.values(ReviewStatus) as [ReviewStatus, ...ReviewStatus[]]),
  title: z.string().max(MAX_RESULT_TITLE_CHARS),
  summary: z.string().max(MAX_RESULT_SUMMARY_CHARS),
  skipReason: z.string().max(60).nullable(),
  counts: z.object(
    Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, count])) as Record<
      (typeof SEVERITY_ORDER)[number],
      typeof count
    >,
  ),
  questions: z
    .array(
      z.object({
        file: z.string().max(300),
        line: z.number().int().min(0),
        text: z.string().max(MAX_RESULT_QUESTION_CHARS),
      }),
    )
    .max(MAX_RESULT_QUESTIONS),
  coverage: z.object({
    complete: z.boolean(),
    unreviewedFiles: count,
    gaps: z.array(z.enum(Object.values(CoverageGap) as [CoverageGap, ...CoverageGap[]])).max(10),
  }),
});

export const decodeResultMarker = (summary: string): ReviewResultSnapshot | null => {
  const encoded = MARKER_PATTERN.exec(summary)?.[1];
  if (encoded === undefined || encoded.length > MAX_RESULT_MARKER_CHARS) return null;
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(decodeURIComponent(encoded)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
