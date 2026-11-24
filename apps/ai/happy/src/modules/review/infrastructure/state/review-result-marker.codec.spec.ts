import * as fc from 'fast-check';

import { FindingKind } from '../../domain/constants/finding-classification.constants';
import {
  MAX_RESULT_MARKER_CHARS,
  MAX_RESULT_QUESTIONS,
  MAX_RESULT_QUESTION_CHARS,
  MAX_RESULT_SUMMARY_CHARS,
  MAX_RESULT_TITLE_CHARS,
  MAX_TRACKED_EXCERPT_CHARS,
  MAX_TRACKED_FINDINGS,
  MAX_TRACKED_MESSAGE_CHARS,
} from '../../domain/constants/review-limits.constants';
import { FindingCategory, Severity } from '../../domain/constants/severity.constants';
import { CoverageGap, ReviewStatus } from '../../domain/entities/review-outcome';
import {
  ResultKind,
  type ResultTracking,
  type ReviewResultSnapshot,
} from '../../domain/entities/review-result';
import { FullReviewReason, ReviewMode } from '../../domain/entities/review-scope';
import { FindingStatus } from '../../domain/entities/tracked-finding';
import { toBase64Url } from '../../domain/policies/base64url';
import { renderResultMarker } from '../../domain/policies/review-result';

import { decodeResultMarker } from './review-result-marker.codec';

const count = fc.integer({ min: 0, max: 50 });

const trackedFindingArb = fc.record({
  fingerprint: fc.stringMatching(/^[0-9a-f]{16}$/),
  file: fc.string({ maxLength: 100 }),
  line: fc.integer({ min: 0, max: 100_000 }),
  severity: fc.constantFrom(...Object.values(Severity)),
  category: fc.constantFrom(...Object.values(FindingCategory)),
  kind: fc.constantFrom(...Object.values(FindingKind)),
  message: fc.string({ maxLength: MAX_TRACKED_MESSAGE_CHARS }),
  excerpt: fc.string({ maxLength: MAX_TRACKED_EXCERPT_CHARS }),
  status: fc.constantFrom(...Object.values(FindingStatus)),
});

const trackingArb: fc.Arbitrary<ResultTracking> = fc.record({
  reviewedSha: fc.stringMatching(/^[0-9a-f]{40}$/),
  scope: fc.oneof(
    fc.record({
      mode: fc.constant(ReviewMode.INCREMENTAL),
      baseSha: fc.stringMatching(/^[0-9a-f]{40}$/),
      reason: fc.constant(null),
      files: count,
    }),
    fc.record({
      mode: fc.constant(ReviewMode.FULL),
      baseSha: fc.constant(null),
      reason: fc.constantFrom(...Object.values(FullReviewReason)),
      files: count,
    }),
  ),
  counts: fc.record({ new: count, stillOpen: count, resolved: count, needsRecheck: count }),
  findings: fc.array(trackedFindingArb, { maxLength: 8 }),
});

const snapshotArb: fc.Arbitrary<ReviewResultSnapshot> = fc.record({
  kind: fc.constantFrom(...Object.values(ResultKind)),
  status: fc.constantFrom(...Object.values(ReviewStatus)),
  title: fc.string({ maxLength: MAX_RESULT_TITLE_CHARS }),
  summary: fc.string({ maxLength: MAX_RESULT_SUMMARY_CHARS }),
  skipReason: fc.option(fc.string({ maxLength: 40 }), { nil: null }),
  counts: fc.record({ critical: count, major: count, minor: count, nit: count }),
  questions: fc.array(
    fc.record({
      file: fc.string({ maxLength: 100 }),
      line: fc.integer({ min: 0, max: 100_000 }),
      text: fc.string({ maxLength: MAX_RESULT_QUESTION_CHARS }),
    }),
    { maxLength: MAX_RESULT_QUESTIONS },
  ),
  coverage: fc.record({
    complete: fc.boolean(),
    unreviewedFiles: count,
    gaps: fc.array(fc.constantFrom(...Object.values(CoverageGap)), { maxLength: 5 }),
  }),
  tracking: fc.option(trackingArb, { nil: null }),
});

const legacyMarker = (snapshot: Omit<ReviewResultSnapshot, 'tracking'>): string =>
  `<!-- happy:result:v1 ${encodeURIComponent(JSON.stringify(snapshot))} -->`;

const hostile = (snapshot: ReviewResultSnapshot): ReviewResultSnapshot => ({
  ...snapshot,
  summary: `${snapshot.summary} --> <script>alert(1)</script> <!-- happy:result:v1 x -->`,
});

describe('review result marker', () => {
  it('survives a round trip for any snapshot', () => {
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const marker = renderResultMarker(snapshot);
        return (
          marker === '' ||
          JSON.stringify(decodeResultMarker(`text\n\n${marker}`)) === JSON.stringify(snapshot)
        );
      }),
    );
  });

  it('reads an older v1 marker as a snapshot without tracked state', () => {
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const { tracking: _tracking, ...legacy } = snapshot;
        return (
          JSON.stringify(decodeResultMarker(legacyMarker(legacy))) ===
          JSON.stringify({ ...legacy, tracking: null })
        );
      }),
    );
  });

  it('migrates v1 to v2: re-rendering a decoded v1 snapshot round trips', () => {
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const { tracking: _tracking, ...legacy } = snapshot;
        const migrated = decodeResultMarker(legacyMarker(legacy));
        const rendered = migrated === null ? '' : renderResultMarker(migrated);
        return (
          migrated !== null &&
          rendered.startsWith('<!-- happy:result:v2 ') &&
          JSON.stringify(decodeResultMarker(rendered)) === JSON.stringify(migrated)
        );
      }),
    );
  });

  it('trusts the last marker, so text above it cannot replace the state', () => {
    fc.assert(
      fc.property(snapshotArb, snapshotArb, (fake, real) => {
        const fakeMarker = renderResultMarker(fake);
        const realMarker = renderResultMarker(real);
        return (
          fakeMarker === '' ||
          realMarker === '' ||
          JSON.stringify(decodeResultMarker(`${fakeMarker}\n${realMarker}`)) ===
            JSON.stringify(real)
        );
      }),
    );
  });

  it('keeps the counts but drops the tracked findings when they do not fit', () => {
    const findings = Array.from({ length: MAX_TRACKED_FINDINGS }, (_, index) => ({
      fingerprint: `${index}`.padStart(16, '0'),
      file: 'f'.repeat(300),
      line: index,
      severity: Severity.MAJOR,
      category: FindingCategory.CORRECTNESS,
      kind: FindingKind.FINDING,
      message: 'Ж'.repeat(MAX_TRACKED_MESSAGE_CHARS),
      excerpt: 'Ж'.repeat(MAX_TRACKED_EXCERPT_CHARS),
      status: FindingStatus.NEW,
    }));
    const tracking: ResultTracking = {
      reviewedSha: 'a'.repeat(40),
      scope: {
        mode: ReviewMode.FULL,
        baseSha: null,
        reason: FullReviewReason.NO_PREVIOUS,
        files: 3,
      },
      counts: { new: findings.length, stillOpen: 0, resolved: 0, needsRecheck: 0 },
      findings,
    };
    const snapshot: ReviewResultSnapshot = {
      kind: 'review',
      status: ReviewStatus.REVIEWED,
      title: 't',
      summary: 's',
      skipReason: null,
      counts: { critical: 0, major: findings.length, minor: 0, nit: 0 },
      questions: [],
      coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
      tracking,
    };
    const marker = renderResultMarker(snapshot);
    expect(marker.length).toBeLessThanOrEqual(MAX_RESULT_MARKER_CHARS);
    expect(decodeResultMarker(marker)).toEqual({ ...snapshot, tracking: null });
  });

  it('cannot be closed early or smuggle markup, whatever the model wrote', () => {
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const marker = renderResultMarker(hostile(snapshot));
        const inner = marker.slice(marker.indexOf(' ', 5), marker.length - 4);
        return (
          marker === '' || (!inner.includes('>') && !inner.includes('<') && marker.endsWith('-->'))
        );
      }),
    );
  });

  it.each([
    '',
    'no marker here',
    '<!-- happy:result:v1 not-json -->',
    '<!-- happy:result:v1 %7B%22status%22%3A%22hacked%22%7D -->',
    '<!-- happy:result:v2 %7B%7D -->',
    '<!-- happy:result:v2 e30 -->',
    '<!-- happy:result:v3 e30 -->',
    '<!-- happy:result:v1 %E0%A4%A -->',
  ])('returns null for %p', (summary) => {
    expect(decodeResultMarker(summary)).toBeNull();
  });

  it('never throws on arbitrary text', () => {
    fc.assert(fc.property(fc.string(), (text) => decodeResultMarker(text) === null || true));
  });

  it('keeps the kind through a round trip, and derives it for a marker that has none', () => {
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const marker = renderResultMarker(snapshot);
        return marker === '' || decodeResultMarker(marker)?.kind === snapshot.kind;
      }),
    );
    const { kind: _kind, ...withoutKind } = {
      kind: ResultKind.REVIEW,
      status: ReviewStatus.CHECKLIST,
      title: 'Список вантажу на виїзд.',
      summary: '',
      skipReason: null,
      counts: { critical: 0, major: 0, minor: 0, nit: 0 },
      questions: [],
      coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
      tracking: null,
    };
    const encoded = toBase64Url(JSON.stringify(withoutKind));
    expect(decodeResultMarker(`<!-- happy:result:v2 ${encoded} -->`)?.kind).toBe(
      ResultKind.RELEASE_CHECKLIST,
    );
  });
});
