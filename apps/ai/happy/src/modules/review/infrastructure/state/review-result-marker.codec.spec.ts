import * as fc from 'fast-check';

import {
  MAX_RESULT_QUESTIONS,
  MAX_RESULT_QUESTION_CHARS,
  MAX_RESULT_SUMMARY_CHARS,
  MAX_RESULT_TITLE_CHARS,
} from '../../domain/constants/review-limits.constants';
import { CoverageGap, ReviewStatus } from '../../domain/entities/review-outcome';
import type { ReviewResultSnapshot } from '../../domain/entities/review-result';
import { renderResultMarker } from '../../domain/policies/review-result';

import { decodeResultMarker } from './review-result-marker.codec';

const count = fc.integer({ min: 0, max: 50 });

const snapshotArb: fc.Arbitrary<ReviewResultSnapshot> = fc.record({
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
});

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
    '<!-- happy:result:v1 %E0%A4%A -->',
  ])('returns null for %p', (summary) => {
    expect(decodeResultMarker(summary)).toBeNull();
  });

  it('never throws on arbitrary text', () => {
    fc.assert(fc.property(fc.string(), (text) => decodeResultMarker(text) === null || true));
  });
});
