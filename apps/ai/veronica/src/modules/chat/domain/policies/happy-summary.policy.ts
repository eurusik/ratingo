import {
  GITHUB_WEB_PREFIX,
  HAPPY_QUESTIONS_SHOWN,
  HAPPY_QUESTION_MAX_CHARS,
  HAPPY_SUMMARY_MAX_CHARS,
  SHORT_SHA_LENGTH,
} from '../constants/happy.constants';
import {
  HappyResultStatus,
  HappyScopeMode,
  HappySeverity,
  type HappyQuestion,
  type HappyResult,
  type HappyStatusCounts,
} from '../entities/happy';

import { clip, stripLinks } from './answer-sanitizer.policy';

const SEVERITY_LABELS: Readonly<Record<HappySeverity, string>> = {
  [HappySeverity.CRITICAL]: 'критичних',
  [HappySeverity.MAJOR]: 'важливих',
  [HappySeverity.MINOR]: 'дрібних',
  [HappySeverity.NIT]: 'дрібниць',
};

const SKIP_REASON_TEXT: Readonly<Record<string, string>> = {
  trivial: 'зміни дрібні, огляд не потрібен',
  too_large: 'PR завеликий для одного огляду, його варто розбити',
  docs_only: 'змінено лише документацію',
  draft: 'це чернетка',
  untrusted_fork: 'PR від автора з форка, якого немає серед довірених',
  bot_author: 'PR створив бот',
  nothing_to_review: 'немає що оглядати',
};

const FULL_REASON_TEXT: Readonly<Record<string, string>> = {
  no_previous: 'попереднього огляду не знайшов',
  requested: 'за твоїм запитом',
  history_rewritten: 'історію гілки переписано',
  compare_failed: 'не вдалося порівняти з минулим оглядом',
  previous_unreadable: 'минулий огляд не вдалося прочитати',
  previous_incomplete: 'минулий огляд був неповним',
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const safeText = (text: string, maxChars: number): string =>
  escapeHtml(clip(stripLinks(text).replace(/\s+/g, ' ').trim(), maxChars));

const countsLine = (result: HappyResult): string => {
  const parts = (Object.values(HappySeverity) as HappySeverity[])
    .filter((severity) => result.counts[severity] > 0)
    .map((severity) => `${SEVERITY_LABELS[severity]}: ${result.counts[severity]}`);
  if (parts.length > 0) return `Зауваження: ${parts.join(', ')}.`;
  return result.coverage.complete
    ? 'Зауважень немає.'
    : 'У переглянутому зауважень не знайдено, але покриття неповне.';
};

const progressText = (counts: HappyStatusCounts): string =>
  [
    `✅ ${counts.resolved} виправлено`,
    `⚠️ ${counts.stillOpen} лишилось`,
    `🆕 ${counts.new} нових`,
    ...(counts.needsRecheck > 0 ? [`❓ ${counts.needsRecheck} не підтверджено`] : []),
  ].join(' · ');

const hasProgress = (counts: HappyStatusCounts): boolean =>
  counts.resolved + counts.stillOpen + counts.needsRecheck > 0;

const reviewLines = (result: HappyResult): string[] => {
  const review = result.review;
  if (review === null) return [];
  if (review.mode === HappyScopeMode.INCREMENTAL) {
    return [`нові коміти: ${progressText(review.statusCounts)}`];
  }
  return [
    `Повне рев’ю: ${FULL_REASON_TEXT[review.fullReason ?? ''] ?? 'причину не вказано'}.`,
    ...(hasProgress(review.statusCounts)
      ? [`від минулого огляду: ${progressText(review.statusCounts)}`]
      : []),
  ];
};

const questionLine = (question: HappyQuestion): string =>
  `• ${escapeHtml(clip(question.file, 80))}:${question.line}: ${safeText(question.text, HAPPY_QUESTION_MAX_CHARS)}`;

const questionsBlock = (result: HappyResult): string[] =>
  result.questions.length === 0
    ? []
    : [
        `Питання до автора: ${result.questions.length}.`,
        ...result.questions.slice(0, HAPPY_QUESTIONS_SHOWN).map(questionLine),
      ];

const coverageLine = (result: HappyResult): string[] =>
  result.coverage.complete
    ? []
    : [
        result.coverage.unreviewedFiles > 0
          ? `Покриття неповне: не переглянуто уважно файлів: ${result.coverage.unreviewedFiles}.`
          : 'Покриття неповне.',
      ];

const staleLine = (result: HappyResult): string[] =>
  result.current
    ? []
    : [
        `<i>Це огляд коміту ${escapeHtml(result.checkedSha.slice(0, SHORT_SHA_LENGTH))}, у PR уже новіші зміни.</i>`,
      ];

const linkLine = (result: HappyResult): string[] =>
  result.checkRunUrl !== null && result.checkRunUrl.startsWith(GITHUB_WEB_PREFIX)
    ? [`Повний звіт: ${escapeHtml(result.checkRunUrl)}`]
    : [];

const bodyFor = (result: HappyResult): string[] => {
  switch (result.status) {
    case HappyResultStatus.REVIEWED:
    case HappyResultStatus.INCOMPLETE:
      return [
        ...(result.summary === '' ? [] : [safeText(result.summary, HAPPY_SUMMARY_MAX_CHARS)]),
        ...reviewLines(result),
        countsLine(result),
        ...questionsBlock(result),
        ...coverageLine(result),
      ];
    case HappyResultStatus.SKIPPED:
      return [
        `Огляд пропущено: ${SKIP_REASON_TEXT[result.skipReason ?? ''] ?? 'причину не вказано'}.`,
      ];
    case HappyResultStatus.CHECKLIST:
      return ['Це реліз-PR, тож замість огляду коду Хеппі склав список перевірок.'];
    case HappyResultStatus.UNKNOWN:
      return ['Результат є, але в старому форматі: подробиці за посиланням.'];
  }
};

export const renderHappyResult = (pullNumber: number, result: HappyResult): string =>
  [
    `<b>Хеппі про PR №${pullNumber}</b>`,
    ...(result.title === '' ? [] : [`<i>${safeText(result.title, HAPPY_SUMMARY_MAX_CHARS)}</i>`]),
    ...bodyFor(result),
    ...staleLine(result),
    ...linkLine(result),
  ].join('\n');
