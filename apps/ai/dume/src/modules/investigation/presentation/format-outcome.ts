import {
  AssumptionOrigin,
  type Assumption,
  type CitationProblem,
  type Citation,
  type ShownEvidence,
  type VerifiedClaim,
} from '../domain/entities/investigation-answer';
import {
  InvestigationStatus,
  type InvestigationOutcome,
} from '../domain/entities/investigation-outcome';

const LAST_C0_CONTROL = 31;
const FIRST_C1_CONTROL = 127;
const LAST_C1_CONTROL = 159;

const isControl = (code: number): boolean =>
  code <= LAST_C0_CONTROL || (code >= FIRST_C1_CONTROL && code <= LAST_C1_CONTROL);

export const plainLine = (text: string): string =>
  [...text]
    .map((char) => (isControl(char.charCodeAt(0)) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

const citationText = (citation: Citation): string =>
  `${citation.path}:${citation.startLine}${citation.endLine === citation.startLine ? '' : `-${citation.endLine}`}`;

const evidenceText = (evidence: ShownEvidence): string =>
  `${evidence.ref}: ${plainLine(evidence.summary)}`;

const factLines = (fact: VerifiedClaim, index: number): string[] => [
  `  ${index + 1}. ${plainLine(fact.text)}`,
  ...(fact.citations.length === 0
    ? []
    : [`     ${fact.citations.map((citation) => plainLine(citationText(citation))).join(', ')}`]),
  ...fact.evidence.map((evidence) => `     runtime ${evidenceText(evidence)}`),
];

const section = (title: string, lines: readonly string[]): string[] =>
  lines.length === 0 ? [] : ['', `${title}:`, ...lines];

const problemText = (problem: CitationProblem): string =>
  problem.evidenceRef === undefined
    ? problem.failure
    : `${problem.failure}: ${plainLine(problem.evidenceRef)}`;

const assumptionLine = (assumption: Assumption, index: number): string =>
  assumption.origin === AssumptionOrigin.UNVERIFIED_CLAIM
    ? `  ${index + 1}. [unverified claim: ${assumption.problems.map(problemText).join(', ')}] ${plainLine(assumption.text)}`
    : `  ${index + 1}. ${plainLine(assumption.text)}`;

export const formatOutcome = (outcome: InvestigationOutcome): string => {
  const footer = [
    '',
    `commit: ${outcome.commit ?? 'none'} (${outcome.ref})`,
    `turns: ${outcome.turns}  cost: $${outcome.costUsd.toFixed(4)}  stop: ${outcome.stopReason ?? 'none'}${outcome.stopDetail === null ? '' : ` (${plainLine(outcome.stopDetail)})`}`,
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
    plainLine(answer.answer),
    ...section(
      'Facts (each citation was read in this run and exists at the commit; each runtime row was shown by a tool in this run)',
      answer.facts.flatMap(factLines),
    ),
    ...section('Assumptions and unverified claims', answer.assumptions.map(assumptionLine)),
    ...section(
      'Unknowns',
      answer.unknowns.map((text, index) => `  ${index + 1}. ${plainLine(text)}`),
    ),
    '',
    `support: ${answer.support}`,
    ...footer,
  ].join('\n');
};
