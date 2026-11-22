import { SEVERITY_ORDER } from '../constants/severity.constants';
import type { ValidatedFinding } from '../entities/finding';
import { formatPullRequest } from '../entities/pull-request';
import type { CompletedReview, SkippedReview } from '../entities/review-outcome';
import { ReviewStatus } from '../entities/review-outcome';

import { sanitizeModelText } from './output-sanitizer';

const SHORT_SHA_LENGTH = 7;
const MIN_FENCE_LENGTH = 3;
const COST_DECIMALS = 4;
const TRUNCATED_NOTE = 'Увага: PR завеликий, частину файлів або їхніх diff не було переглянуто.';

const fenceFor = (code: string): string => {
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  return '`'.repeat(Math.max(MIN_FENCE_LENGTH, longestRun + 1));
};

const renderSuggestion = (suggestion: string): string => {
  const fence = fenceFor(suggestion);
  return `${fence}\n${suggestion}\n${fence}`;
};

const safePath = (path: string): string => path.replace(/`/g, "'");

const renderFinding = (finding: ValidatedFinding): string => {
  const head = `**${finding.severity}** · ${finding.category} · \`${safePath(finding.file)}:${finding.line}\``;
  const lines = [head, sanitizeModelText(finding.message)];
  if (finding.suggestion !== undefined && finding.suggestion.trim().length > 0) {
    lines.push('Пропозиція:', renderSuggestion(finding.suggestion));
  }
  return lines.join('\n');
};

const countBySeverity = (findings: readonly ValidatedFinding[]): string =>
  SEVERITY_ORDER.map((severity) => ({
    severity,
    count: findings.filter((finding) => finding.severity === severity).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ severity, count }) => `${count} ${severity}`)
    .join(', ');

const heading = (review: { ref: Parameters<typeof formatPullRequest>[0] }): string =>
  `## Ревʼю Happy: ${formatPullRequest(review.ref)}`;

export const renderSkippedReview = (review: Omit<SkippedReview, 'markdown'>): string =>
  [heading(review), '', `Пропущено: \`${review.reason}\`. Модель не викликалась.`].join('\n');

export const renderCompletedReview = (review: Omit<CompletedReview, 'markdown'>): string => {
  const incomplete = review.status === ReviewStatus.INCOMPLETE;
  const footer = [
    `Коміт ${review.headSha.slice(0, SHORT_SHA_LENGTH)}`,
    `файлів переглянуто уважно: ${review.reviewedFiles.length}`,
    `відхилено перевіркою: ${review.dropped.length}`,
    `вартість $${review.costUsd.toFixed(COST_DECIMALS)}`,
  ].join(' · ');
  return [
    heading(review),
    '',
    incomplete
      ? `Ревʼю зупинилось раніше (\`${review.stopReason}\`), тому список може бути неповним.`
      : sanitizeModelText(review.summary),
    ...(review.truncated ? ['', TRUNCATED_NOTE] : []),
    '',
    review.findings.length === 0
      ? 'Зауважень немає.'
      : `### Зауваження (${countBySeverity(review.findings)})`,
    ...review.findings.flatMap((finding) => ['', renderFinding(finding)]),
    '',
    `<sub>${footer}</sub>`,
  ].join('\n');
};
