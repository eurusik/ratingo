import { z } from 'zod';

import { FINDING_KINDS } from '../../domain/constants/finding-classification.constants';
import {
  LEGACY_RESULT_MARKER_VERSION,
  MAX_RESULT_MARKER_CHARS,
  MAX_RESULT_QUESTIONS,
  MAX_RESULT_QUESTION_CHARS,
  MAX_RESULT_SUMMARY_CHARS,
  MAX_RESULT_TITLE_CHARS,
  MAX_TRACKED_EXCERPT_CHARS,
  MAX_TRACKED_FINDINGS,
  MAX_TRACKED_MESSAGE_CHARS,
  RESULT_MARKER_VERSION,
} from '../../domain/constants/review-limits.constants';
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  SEVERITY_ORDER,
} from '../../domain/constants/severity.constants';
import { CoverageGap, ReviewStatus } from '../../domain/entities/review-outcome';
import { ResultKind, type ReviewResultSnapshot } from '../../domain/entities/review-result';
import { FULL_REVIEW_REASONS, ReviewMode } from '../../domain/entities/review-scope';
import { FINDING_STATUSES } from '../../domain/entities/tracked-finding';
import { RESULT_MARKER_PREFIX, resultKindFor } from '../../domain/policies/review-result';

const MARKER_PATTERN = new RegExp(
  `${RESULT_MARKER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+) ([^\\s>]+) -->`,
  'g',
);

const count = z.number().int().min(0).max(1_000);

const trackedFindingSchema = z.object({
  fingerprint: z.string().max(32),
  file: z.string().max(300),
  line: z.number().int().min(0),
  severity: z.enum(FINDING_SEVERITIES),
  category: z.enum(FINDING_CATEGORIES),
  kind: z.enum(FINDING_KINDS),
  message: z.string().max(MAX_TRACKED_MESSAGE_CHARS),
  excerpt: z.string().max(MAX_TRACKED_EXCERPT_CHARS),
  status: z.enum(FINDING_STATUSES),
});

const trackingSchema = z.object({
  reviewedSha: z.string().max(64),
  scope: z.object({
    mode: z.enum([ReviewMode.INCREMENTAL, ReviewMode.FULL]),
    baseSha: z.string().max(64).nullable(),
    reason: z.enum(FULL_REVIEW_REASONS).nullable(),
    files: count,
  }),
  counts: z.object({
    new: count,
    stillOpen: count,
    resolved: count,
    needsRecheck: count,
  }),
  findings: z.array(trackedFindingSchema).max(MAX_TRACKED_FINDINGS),
});

const legacySnapshotSchema = z.object({
  kind: z.enum(Object.values(ResultKind) as [ResultKind, ...ResultKind[]]).optional(),
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

const checklistSchema = z.object({
  migrations: count,
  riskyMigrations: count,
  envVars: count,
  services: count,
  dependencyChanges: count,
  lockfileChanged: z.boolean(),
});

const snapshotSchema = legacySnapshotSchema.extend({
  tracking: trackingSchema.nullable(),
  checklist: checklistSchema.nullish(),
});

const withDefaults = (
  snapshot: Omit<ReviewResultSnapshot, 'kind' | 'checklist'> & {
    kind?: ResultKind;
    checklist?: ReviewResultSnapshot['checklist'] | undefined;
  },
): ReviewResultSnapshot => ({
  ...snapshot,
  kind: snapshot.kind ?? resultKindFor(snapshot.status),
  checklist: snapshot.checklist ?? null,
});

const decodePayload = (version: number, encoded: string): ReviewResultSnapshot | null => {
  if (version === LEGACY_RESULT_MARKER_VERSION) {
    const parsed = legacySnapshotSchema.safeParse(JSON.parse(decodeURIComponent(encoded)));
    return parsed.success ? withDefaults({ ...parsed.data, tracking: null }) : null;
  }
  if (version === RESULT_MARKER_VERSION) {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = snapshotSchema.safeParse(JSON.parse(json));
    return parsed.success ? withDefaults(parsed.data) : null;
  }
  return null;
};

export const decodeResultMarker = (summary: string): ReviewResultSnapshot | null => {
  const last = [...summary.matchAll(MARKER_PATTERN)].at(-1);
  const version = Number(last?.[1]);
  const encoded = last?.[2];
  if (encoded === undefined || encoded.length > MAX_RESULT_MARKER_CHARS) return null;
  try {
    return decodePayload(version, encoded);
  } catch {
    return null;
  }
};
