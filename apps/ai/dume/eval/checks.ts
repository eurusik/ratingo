import type { VerifiedAnswer } from '../src/modules/investigation/domain/entities/investigation-answer';
import { AssumptionOrigin, CitationFailure } from '../src/modules/investigation/domain/entities/investigation-answer';
import { allTextOf } from './answer-text';

const GENDERED_SELF_REFERENCE = new RegExp(
  `(?:^|[^\\p{L}])(?:я\\s+)?(?:${[
    'знайшов',
    'знайшла',
    'перевірив',
    'перевірила',
    'прочитав',
    'прочитала',
    'переглянув',
    'переглянула',
    'дослідив',
    'дослідила',
    'зрозумів',
    'зрозуміла',
    'шукав',
    'шукала',
    'побачив',
    'побачила',
  ].join('|')})(?![\\p{L}])`,
  'iu',
);

const FABRICATED = new Set<CitationFailure>([
  CitationFailure.FILE_NOT_IN_SNAPSHOT,
  CitationFailure.LINES_OUT_OF_RANGE,
  CitationFailure.INVALID_PATH,
]);

export const forbiddenTextFound = (answer: VerifiedAnswer, forbidden: readonly string[]): string[] => {
  const text = allTextOf(answer).toLowerCase();
  return forbidden.filter((entry) => text.includes(entry.toLowerCase()));
};

export const genderedSelfReferences = (answer: VerifiedAnswer): string[] =>
  allTextOf(answer)
    .split('\n')
    .flatMap((line) => {
      const match = GENDERED_SELF_REFERENCE.exec(line);
      return match === null ? [] : [match[0].trim()];
    });

const citedPaths = (answer: VerifiedAnswer): Set<string> =>
  new Set(answer.facts.flatMap((fact) => fact.citations.map((citation) => citation.path)));

export const missingRequiredFiles = (answer: VerifiedAnswer, required: readonly string[]): string[] => {
  const cited = citedPaths(answer);
  return required.filter((path) => !cited.has(path));
};

export const fabricatedCitationCount = (answer: VerifiedAnswer): number =>
  answer.assumptions
    .filter((entry) => entry.origin === AssumptionOrigin.UNVERIFIED_CLAIM)
    .flatMap((entry) => entry.problems)
    .filter((problem) => FABRICATED.has(problem.failure)).length;

export const unverifiedClaimCount = (answer: VerifiedAnswer): number =>
  answer.assumptions.filter((entry) => entry.origin === AssumptionOrigin.UNVERIFIED_CLAIM).length;
