import {
  AssumptionOrigin,
  type Assumption,
  type Citation,
} from '../domain/entities/investigation-answer';
import {
  InvestigationStatus,
  type InvestigationOutcome,
} from '../domain/entities/investigation-outcome';

const citationText = (citation: Citation): string =>
  `${citation.path}:${citation.startLine}${citation.endLine === citation.startLine ? '' : `-${citation.endLine}`}`;

const section = (title: string, lines: readonly string[]): string[] =>
  lines.length === 0 ? [] : ['', `${title}:`, ...lines];

const assumptionLine = (assumption: Assumption, index: number): string =>
  assumption.origin === AssumptionOrigin.UNVERIFIED_CLAIM
    ? `  ${index + 1}. [unverified claim: ${assumption.problems.map((problem) => problem.failure).join(', ')}] ${assumption.text}`
    : `  ${index + 1}. ${assumption.text}`;

export const formatOutcome = (outcome: InvestigationOutcome): string => {
  const footer = [
    '',
    `commit: ${outcome.commit ?? 'none'} (${outcome.ref})`,
    `turns: ${outcome.turns}  cost: $${outcome.costUsd.toFixed(4)}  stop: ${outcome.stopReason ?? 'none'}${outcome.stopDetail === null ? '' : ` (${outcome.stopDetail})`}`,
  ];
  if (outcome.status === InvestigationStatus.SNAPSHOT_UNAVAILABLE) {
    return [
      'The code could not be fetched.',
      `reason: ${outcome.snapshotFailure ?? 'unknown'}`,
      ...footer,
    ].join('\n');
  }
  if (outcome.answer === null) {
    return ['No answer: the run ended before a valid answer was given.', ...footer].join('\n');
  }
  const { answer } = outcome;
  return [
    answer.answer,
    ...section(
      'Facts (each citation was read in this run and exists at the commit)',
      answer.facts.flatMap((fact, index) => [
        `  ${index + 1}. ${fact.text}`,
        `     ${fact.citations.map(citationText).join(', ')}`,
      ]),
    ),
    ...section('Assumptions and unverified claims', answer.assumptions.map(assumptionLine)),
    ...section(
      'Unknowns',
      answer.unknowns.map((text, index) => `  ${index + 1}. ${text}`),
    ),
    '',
    `support: ${answer.support}`,
    ...footer,
  ].join('\n');
};
