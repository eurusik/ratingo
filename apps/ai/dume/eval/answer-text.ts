import { AssumptionOrigin, type VerifiedAnswer } from '../src/modules/investigation/public';

const bullets = (items: readonly string[]): string[] => items.map((item) => `- ${item}`);

export const plainTextOf = (answer: VerifiedAnswer): string =>
  [
    answer.answer,
    '',
    'Verified facts:',
    ...bullets(answer.facts.map((fact) => fact.text)),
    'Assumptions:',
    ...bullets(
      answer.assumptions
        .filter((entry) => entry.origin === AssumptionOrigin.STATED_BY_MODEL)
        .map((entry) => entry.text),
    ),
    'Claims whose citations did not verify:',
    ...bullets(
      answer.assumptions
        .filter((entry) => entry.origin === AssumptionOrigin.UNVERIFIED_CLAIM)
        .map((entry) => entry.text),
    ),
    'Unknowns:',
    ...bullets(answer.unknowns),
  ].join('\n');

export const allTextOf = (answer: VerifiedAnswer): string =>
  [
    answer.answer,
    ...answer.facts.map((fact) => fact.text),
    ...answer.assumptions.map((entry) => entry.text),
    ...answer.unknowns,
  ].join('\n');
