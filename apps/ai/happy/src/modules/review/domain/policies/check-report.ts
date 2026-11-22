import {
  MAX_ANNOTATION_MESSAGE_CHARS,
  MAX_ANNOTATION_TITLE_CHARS,
  MAX_CHECK_ANNOTATIONS,
  MAX_CHECK_SUMMARY_CHARS,
} from '../constants/review-limits.constants';
import { Severity } from '../constants/severity.constants';
import { AnnotationLevel, CheckConclusion } from '../entities/check-report';
import type { CheckAnnotation, CheckReport } from '../entities/check-report';
import type { ValidatedFinding } from '../entities/finding';
import type { ReviewOutcome } from '../entities/review-outcome';
import { ReviewStatus } from '../entities/review-outcome';

import { checkVoiceLine } from './check-voice';
import { sanitizeModelText } from './output-sanitizer';
import { buildResultSnapshot, renderResultMarker } from './review-result';

const QUESTION_TITLE_PREFIX = 'Питання';

const levelFor = (finding: ValidatedFinding, isQuestion: boolean): AnnotationLevel =>
  !isQuestion && (finding.severity === Severity.CRITICAL || finding.severity === Severity.MAJOR)
    ? AnnotationLevel.WARNING
    : AnnotationLevel.NOTICE;

const toAnnotation = (finding: ValidatedFinding, isQuestion: boolean): CheckAnnotation => ({
  path: finding.file,
  line: finding.line,
  level: levelFor(finding, isQuestion),
  title: `${isQuestion ? QUESTION_TITLE_PREFIX : finding.severity}: ${finding.category}`.slice(
    0,
    MAX_ANNOTATION_TITLE_CHARS,
  ),
  message: sanitizeModelText(finding.message).slice(0, MAX_ANNOTATION_MESSAGE_CHARS),
});

const annotationsFor = (outcome: ReviewOutcome): CheckAnnotation[] =>
  outcome.status === ReviewStatus.REVIEWED || outcome.status === ReviewStatus.INCOMPLETE
    ? [
        ...outcome.findings.map((finding) => toAnnotation(finding, false)),
        ...outcome.questions.map((finding) => toAnnotation(finding, true)),
      ].slice(0, MAX_CHECK_ANNOTATIONS)
    : [];

const summaryWithMarker = (outcome: ReviewOutcome): string => {
  const marker = renderResultMarker(buildResultSnapshot(outcome));
  const body = `${checkVoiceLine(outcome)}\n\n${outcome.markdown}`;
  return marker === ''
    ? body.slice(0, MAX_CHECK_SUMMARY_CHARS)
    : `${body.slice(0, MAX_CHECK_SUMMARY_CHARS - marker.length - 2)}\n\n${marker}`;
};

export const buildCheckReport = (outcome: ReviewOutcome): CheckReport => ({
  conclusion: CheckConclusion.NEUTRAL,
  title: checkVoiceLine(outcome),
  summary: summaryWithMarker(outcome),
  annotations: annotationsFor(outcome),
});
