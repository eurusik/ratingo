import {
  FindingCategory,
  Severity,
} from '../src/modules/review/domain/constants/severity.constants';
import { CommitRelation } from '../src/modules/review/domain/entities/pull-request';
import { FullReviewReason, ReviewMode } from '../src/modules/review/domain/entities/review-scope';
import { FindingStatus } from '../src/modules/review/domain/entities/tracked-finding';

import type { IncrementalEvalCase } from './incremental-eval';

const PRICING = 'apps/api/src/modules/billing/application/services/pricing.service.ts';
const RETRY = 'apps/api/src/modules/billing/application/services/retry.service.ts';

const PRICING_WITH_BUG = [
  "import { Injectable } from '@nestjs/common';",
  '',
  '@Injectable()',
  'export class PricingService {',
  '  addTax(net: number, rate: number): number {',
  '    const gross = net * (1 + rate);',
  '    return gross;',
  '  }',
  '',
  '  discount(price: number, percent: number): number {',
  '    return price - (price * percent) / 100;',
  '  }',
  '}',
];

const PRICING_FIXED = [
  ...PRICING_WITH_BUG.slice(0, 6),
  '    return Math.round(gross * 100) / 100;',
  ...PRICING_WITH_BUG.slice(7),
];

const RETRY_BEFORE = [
  "import { Injectable } from '@nestjs/common';",
  '',
  '@Injectable()',
  'export class RetryService {',
  '  async run<T>(task: () => Promise<T>, attempts: number): Promise<T> {',
  '    let lastError: unknown;',
  '    for (let attempt = 0; attempt < attempts; attempt += 1) {',
  '      try {',
  '        return await task();',
  '      } catch (error) {',
  '        lastError = error;',
  '      }',
  '    }',
  '    throw lastError;',
  '  }',
  '}',
];

const RETRY_WITH_NEW_BUG = [
  ...RETRY_BEFORE.slice(0, 8),
  '        return task();',
  ...RETRY_BEFORE.slice(9),
];

const ROUNDING_FINDING = {
  fingerprint: 'eval-rounding',
  file: PRICING,
  line: 7,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  message: 'addTax повертає суму без округлення до копійок',
  excerpt: 'return gross;',
};

export const INCREMENTAL_EVAL_CASES: readonly IncrementalEvalCase[] = [
  {
    id: 'incremental-fix-resolves-finding',
    title: 'the fix commit removes the code the finding pointed at',
    headFiles: { [PRICING]: PRICING_FIXED },
    previous: [ROUNDING_FINDING],
    relation: CommitRelation.AHEAD,
    newCommit: [{ path: PRICING, fromLine: 7, toLine: 7 }],
    expectation: {
      mode: ReviewMode.INCREMENTAL,
      statuses: { 'eval-rounding': FindingStatus.RESOLVED },
    },
  },
  {
    id: 'incremental-unrelated-commit-keeps-open',
    title: 'a commit elsewhere leaves the earlier finding open',
    headFiles: { [PRICING]: PRICING_WITH_BUG, [RETRY]: RETRY_BEFORE },
    previous: [ROUNDING_FINDING],
    relation: CommitRelation.AHEAD,
    newCommit: [{ path: RETRY, fromLine: 14, toLine: 14 }],
    expectation: {
      mode: ReviewMode.INCREMENTAL,
      statuses: { 'eval-rounding': FindingStatus.STILL_OPEN },
    },
  },
  {
    id: 'incremental-new-bug-in-new-commit',
    title: 'the new commit introduces a bug and the old finding stays open',
    headFiles: { [PRICING]: PRICING_WITH_BUG, [RETRY]: RETRY_WITH_NEW_BUG },
    previous: [ROUNDING_FINDING],
    relation: CommitRelation.AHEAD,
    newCommit: [{ path: RETRY, fromLine: 9, toLine: 9 }],
    expectation: {
      mode: ReviewMode.INCREMENTAL,
      statuses: { 'eval-rounding': FindingStatus.STILL_OPEN },
      newFindingAtLine: { path: RETRY, line: 9 },
    },
  },
  {
    id: 'incremental-force-push-falls-back-to-full',
    title: 'after a force-push the history is not comparable, so the review is full',
    headFiles: { [PRICING]: PRICING_WITH_BUG, [RETRY]: RETRY_BEFORE },
    previous: [ROUNDING_FINDING],
    relation: CommitRelation.DIVERGED,
    newCommit: [],
    expectation: {
      mode: ReviewMode.FULL,
      reason: FullReviewReason.HISTORY_REWRITTEN,
      statuses: { 'eval-rounding': 'any' },
    },
  },
];
