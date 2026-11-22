import { FindingKind } from '../constants/finding-classification.constants';
import { SEVERITY_ORDER } from '../constants/severity.constants';
import type { ValidatedFinding } from '../entities/finding';
import { formatPullRequest } from '../entities/pull-request';
import type { CompletedReview, SkippedReview } from '../entities/review-outcome';
import { CoverageGap, isCoverageComplete, ReviewStatus } from '../entities/review-outcome';

import { sanitizeModelText } from './output-sanitizer';

const SHORT_SHA_LENGTH = 7;
const MIN_FENCE_LENGTH = 3;
const COST_DECIMALS = 4;
const MAX_LISTED_UNREVIEWED = 25;
const GAP_NOTES: Readonly<Record<CoverageGap, string>> = {
  [CoverageGap.LISTING_TRUNCATED]: 'PR завеликий: частину файлів або їхніх diff не отримано.',
  [CoverageGap.STOPPED_EARLY]: 'Ревʼю зупинилось раніше, ніж модель закінчила.',
  [CoverageGap.TOOL_FAILED]: 'Частина читання файлів не вдалась.',
  [CoverageGap.DIFFS_NOT_INLINED]:
    'Diff завеликий для промпту: модель отримала лише список файлів і читала код інструментами.',
  [CoverageGap.EVIDENCE_UNREADABLE]:
    'Не вдалося прочитати файли для перевірки доказів: частину зауважень понижено до питань.',
};

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
  const head = `**${finding.kind === FindingKind.QUESTION ? 'питання' : finding.severity}** · ${finding.category} · \`${safePath(finding.file)}:${finding.line}\``;
  const lines = [head, sanitizeModelText(finding.message)];
  if (finding.suggestion !== undefined && finding.suggestion.trim().length > 0) {
    lines.push('Пропозиція:', renderSuggestion(finding.suggestion));
  }
  return lines.join('\n');
};

const renderCoverage = (review: Omit<CompletedReview, 'markdown'>): string[] => {
  if (isCoverageComplete(review.coverage)) return [];
  const { gaps, unreviewedFiles } = review.coverage;
  const shown = unreviewedFiles.slice(0, MAX_LISTED_UNREVIEWED);
  const hidden = unreviewedFiles.length - shown.length;
  return [
    '',
    '### Покриття неповне',
    ...gaps.map((gap) => `- ${GAP_NOTES[gap]}`),
    ...(unreviewedFiles.length > 0
      ? ['- Не переглянуто уважно:', ...shown.map((path) => `  - \`${safePath(path)}\``)]
      : []),
    ...(hidden > 0 ? [`  - ще ${hidden}`] : []),
  ];
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
  const complete = isCoverageComplete(review.coverage);
  const footer = [
    `Коміт ${review.headSha.slice(0, SHORT_SHA_LENGTH)}`,
    `файлів переглянуто уважно: ${review.reviewedFiles.length}`,
    `відхилено перевіркою: ${review.dropped.length}`,
    `вартість $${review.costUsd.toFixed(COST_DECIMALS)}`,
  ].join(' · ');
  const noFindings = complete
    ? 'Зауважень немає.'
    : 'У переглянутому зауважень не знайдено, але покриття неповне: це не означає, що все гаразд.';
  return [
    heading(review),
    '',
    incomplete
      ? `Ревʼю зупинилось раніше (\`${review.stopReason}\`), тому список може бути неповним.`
      : sanitizeModelText(review.summary),
    '',
    review.findings.length === 0
      ? noFindings
      : `### Зауваження (${countBySeverity(review.findings)})`,
    ...review.findings.flatMap((finding) => ['', renderFinding(finding)]),
    ...(review.questions.length === 0
      ? []
      : [
          '',
          `### Питання до автора (${review.questions.length})`,
          ...review.questions.flatMap((question) => ['', renderFinding(question)]),
        ]),
    ...renderCoverage(review),
    '',
    `<sub>${footer}</sub>`,
  ].join('\n');
};
