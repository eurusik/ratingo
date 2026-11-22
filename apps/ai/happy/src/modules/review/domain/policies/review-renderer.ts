import { FindingKind } from '../constants/finding-classification.constants';
import { FULL_REASON_TEXT, STATUS_EMOJI } from '../constants/review-scope.constants';
import { SEVERITY_ORDER } from '../constants/severity.constants';
import type { ValidatedFinding } from '../entities/finding';
import { formatPullRequest } from '../entities/pull-request';
import type { CompletedReview, SkippedReview } from '../entities/review-outcome';
import { CoverageGap, isCoverageComplete, ReviewStatus } from '../entities/review-outcome';
import { ReviewMode, type ReviewScope } from '../entities/review-scope';
import { FindingStatus, type StatusCounts, type TrackedFinding } from '../entities/tracked-finding';

import { countStatuses, openFindings, openQuestions } from './finding-tracking';

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

const statusPrefix = (status: FindingStatus | null): string =>
  status === null ? '' : `${STATUS_EMOJI[status]} `;

const headOf = (
  finding: Pick<TrackedFinding, 'kind' | 'severity' | 'category' | 'file' | 'line'>,
  status: FindingStatus | null,
): string =>
  `${statusPrefix(status)}**${finding.kind === FindingKind.QUESTION ? 'питання' : finding.severity}** · ${finding.category} · \`${safePath(finding.file)}:${finding.line}\``;

const renderTracked = (finding: TrackedFinding, showStatus: boolean): string =>
  [headOf(finding, showStatus ? finding.status : null), sanitizeModelText(finding.message)].join(
    '\n',
  );

const renderFinding = (finding: ValidatedFinding, status: FindingStatus | null): string => {
  const head = headOf(finding, status);
  const lines = [head, sanitizeModelText(finding.message)];
  if (finding.kind === FindingKind.FINDING) {
    lines.push(
      `Сценарій: ${sanitizeModelText(finding.failureScenario)}`,
      `Наслідок: ${sanitizeModelText(finding.impact)}`,
    );
  }
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

const countBySeverity = (findings: readonly Pick<TrackedFinding, 'severity'>[]): string =>
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

const pluralFiles = (count: number): string => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'файлів';
  if (last === 1) return 'файл';
  return last >= 2 && last <= 4 ? 'файли' : 'файлів';
};

const scopeLine = (scope: ReviewScope, headSha: string, files: number): string =>
  scope.mode === ReviewMode.INCREMENTAL
    ? `Переглянув нові коміти ${scope.baseSha.slice(0, SHORT_SHA_LENGTH)}..${headSha.slice(0, SHORT_SHA_LENGTH)} (${files} ${pluralFiles(files)})`
    : `Повне рев’ю: ${FULL_REASON_TEXT[scope.reason]}`;

const progressLine = (counts: StatusCounts): string =>
  [
    `${STATUS_EMOJI[FindingStatus.RESOLVED]} виправлено: ${counts.resolved}`,
    `${STATUS_EMOJI[FindingStatus.STILL_OPEN]} лишилось: ${counts.stillOpen}`,
    `${STATUS_EMOJI[FindingStatus.NEW]} нових: ${counts.new}`,
    ...(counts.needsRecheck > 0
      ? [`${STATUS_EMOJI[FindingStatus.NEEDS_RECHECK]} не підтверджено: ${counts.needsRecheck}`]
      : []),
  ].join(' · ');

const detailsByFingerprint = (
  review: Omit<CompletedReview, 'markdown'>,
): ReadonlyMap<string, ValidatedFinding> =>
  new Map(
    [...review.findings, ...review.questions].map((finding) => [finding.fingerprint, finding]),
  );

const renderCurrent = (
  finding: TrackedFinding,
  details: ReadonlyMap<string, ValidatedFinding>,
  showStatus: boolean,
): string => {
  const detail = details.get(finding.fingerprint);
  return detail !== undefined && finding.status === FindingStatus.NEW
    ? renderFinding(detail, showStatus ? finding.status : null)
    : renderTracked(finding, showStatus);
};

const renderResolved = (resolved: readonly TrackedFinding[]): string[] =>
  resolved.length === 0
    ? []
    : [
        '',
        `### ${STATUS_EMOJI[FindingStatus.RESOLVED]} Виправлено (${resolved.length})`,
        ...resolved.flatMap((finding) => ['', renderTracked(finding, false)]),
      ];

export const renderCompletedReview = (review: Omit<CompletedReview, 'markdown'>): string => {
  const incomplete = review.status === ReviewStatus.INCOMPLETE;
  const complete = isCoverageComplete(review.coverage);
  const { tracking } = review;
  const current = openFindings(tracking.findings);
  const questions = openQuestions(tracking.findings);
  const resolved = tracking.findings.filter((finding) => finding.status === FindingStatus.RESOLVED);
  const details = detailsByFingerprint(review);
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
    scopeLine(tracking.scope, review.headSha, tracking.reviewedFileCount),
    ...(tracking.hadPrevious ? ['', progressLine(countStatuses(tracking.findings))] : []),
    '',
    incomplete
      ? `Ревʼю зупинилось раніше (\`${review.stopReason}\`), тому список може бути неповним.`
      : sanitizeModelText(review.summary),
    '',
    current.length === 0 ? noFindings : `### Зауваження (${countBySeverity(current)})`,
    ...current.flatMap((finding) => ['', renderCurrent(finding, details, tracking.hadPrevious)]),
    ...(questions.length === 0
      ? []
      : [
          '',
          `### Питання до автора (${questions.length})`,
          ...questions.flatMap((question) => [
            '',
            renderCurrent(question, details, tracking.hadPrevious),
          ]),
        ]),
    ...renderResolved(resolved),
    ...renderCoverage(review),
    '',
    `<sub>${footer}</sub>`,
  ].join('\n');
};
