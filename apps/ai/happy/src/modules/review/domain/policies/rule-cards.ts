import { RULE_CARDS, type RuleCard } from '../constants/rule-cards.constants';

import { matchesAnyGlob } from './glob-match';

export const RULE_CARD_IDS = RULE_CARDS.map((card) => card.id) as [string, ...string[]];

export const cardsForPaths = (paths: readonly string[]): RuleCard[] =>
  RULE_CARDS.filter((card) => paths.some((path) => matchesAnyGlob(card.paths, path)));

export const selectRuleCards = (chosenIds: readonly string[]): RuleCard[] => {
  const chosen = new Set(chosenIds);
  return RULE_CARDS.filter((card) => chosen.has(card.id));
};

export const renderRuleCard = (card: RuleCard): string =>
  [
    `## ${card.title}`,
    `Violation: ${card.violation}`,
    `Already protected, do not report: ${card.protectedExample}`,
    `Unclear, ask as a question: ${card.unclear}`,
    `Never report: ${card.doNotReport}`,
  ].join('\n');

export const renderRuleCardCatalog = (): string =>
  RULE_CARDS.map((card) => `- ${card.id}: ${card.title}`).join('\n');
