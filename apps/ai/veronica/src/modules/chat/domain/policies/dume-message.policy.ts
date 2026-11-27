import {
  DUME_ANSWER_MAX_CHARS,
  DUME_CITATIONS_SHOWN,
  DUME_EVIDENCE_SHOWN,
  DUME_EVIDENCE_SUMMARY_MAX_CHARS,
  DUME_FACT_MAX_CHARS,
  DUME_LIST_ITEMS_SHOWN,
  DUME_MAX_MESSAGES,
  DUME_MEMORY_ANSWER_MAX_CHARS,
  DUME_MESSAGE_BUDGET_CHARS,
  DUME_NOTE_MAX_CHARS,
} from '../constants/dume.constants';
import {
  DUME_FAILURE_LINE,
  DUME_PROBLEM_LABEL,
  DUME_SUPPORT_LABEL,
  DUME_UNKNOWN_PROBLEM_LABEL,
} from '../constants/dume-replies.constants';
import { SHORT_SHA_LENGTH } from '../constants/happy.constants';
import type {
  DumeAssumption,
  DumeCitation,
  DumeFact,
  DumeFailureReason,
  DumeResult,
} from '../entities/dume';

import { clip, escapeHtml, stripLinks } from './answer-sanitizer.policy';
import { codeLink, isCommitSha } from './code-link.policy';

const BLOCK_SEPARATOR = '\n\n';
const HEADER = '🔎 <b>DUM-E</b>';
const WHITESPACE_RUN = /\s+/g;

const fitEscaped = (raw: string, limit: number): string => {
  const whole = escapeHtml(raw);
  if (whole.length <= limit) return whole;
  let fitted = '';
  for (const character of raw) {
    const escaped = escapeHtml(character);
    if (fitted.length + escaped.length > limit - 1) break;
    fitted += escaped;
  }
  return `${fitted.trimEnd()}…`;
};

const plain = (text: string, limit: number): string =>
  fitEscaped(stripLinks(text).replace(WHITESPACE_RUN, ' ').trim(), limit);

const citationLabel = ({ path, startLine, endLine }: DumeCitation): string =>
  endLine === startLine ? `${path}:${startLine}` : `${path}:${startLine}-${endLine}`;

const citationHtml = (repository: string, commit: string, citation: DumeCitation): string => {
  const label = escapeHtml(citationLabel(citation));
  const link = codeLink(repository, commit, citation);
  return link === null ? `<code>${label}</code>` : `<a href="${link}">${label}</a>`;
};

const factBlock = (fact: DumeFact, index: number, repository: string, commit: string): string => {
  const citations = fact.citations
    .slice(0, DUME_CITATIONS_SHOWN)
    .map((citation) => citationHtml(repository, commit, citation));
  const evidence = fact.evidence
    .slice(0, DUME_EVIDENCE_SHOWN)
    .map(
      (row) =>
        `<code>${escapeHtml(row.ref)}</code> ${plain(row.summary, DUME_EVIDENCE_SUMMARY_MAX_CHARS)}`,
    );
  return [
    `${index + 1}. ${plain(fact.text, DUME_FACT_MAX_CHARS)}`,
    citations.join(', '),
    ...evidence,
  ]
    .filter((line) => line !== '')
    .join('\n');
};

const problemLabel = (assumption: DumeAssumption): string => {
  const labels = assumption.problems.map(
    (problem) => DUME_PROBLEM_LABEL[problem.failure] ?? DUME_UNKNOWN_PROBLEM_LABEL,
  );
  return labels.length === 0 ? '' : ` (чому: ${[...new Set(labels)].join(', ')})`;
};

const listBlock = (title: string, items: readonly string[]): string[] => {
  if (items.length === 0) return [];
  const shown = items.slice(0, DUME_LIST_ITEMS_SHOWN);
  const omitted = items.length - shown.length;
  return [
    [
      `<b>${title}</b>`,
      ...shown.map((item) => `• ${item}`),
      ...(omitted > 0 ? [`• ще ${omitted}`] : []),
    ].join('\n'),
  ];
};

const footer = (result: DumeResult): string => {
  const commit = isCommitSha(result.commit)
    ? result.commit.slice(0, SHORT_SHA_LENGTH)
    : result.commit;
  const parts = [
    `Підтримка: ${DUME_SUPPORT_LABEL[result.answer.support]}`,
    `коміт ${commit} (${result.ref})`,
    `ходів ${result.turns}`,
    `$${result.costUsd.toFixed(2)}`,
  ];
  return `<i>${escapeHtml(parts.join(' · '))}</i>`;
};

const fits = (current: string, block: string): boolean =>
  current.length + BLOCK_SEPARATOR.length + block.length <= DUME_MESSAGE_BUDGET_CHARS;

const pack = (blocks: readonly string[]): string[] => {
  const messages: string[] = [];
  for (const block of blocks) {
    const last = messages[messages.length - 1];
    if (last !== undefined && fits(last, block)) {
      messages[messages.length - 1] = `${last}${BLOCK_SEPARATOR}${block}`;
    } else {
      messages.push(block);
    }
  }
  return messages;
};

const FACTS_TITLE = '<b>Перевірені факти</b>';

const TEENS_FROM = 11;
const TEENS_TO = 14;

const omittedNote = (count: number): string => {
  const lastDigit = count % 10;
  const teen = count % 100 >= TEENS_FROM && count % 100 <= TEENS_TO;
  if (lastDigit === 1 && !teen) return `Ще ${count} факт не вмістився в повідомлення.`;
  if (lastDigit >= 2 && lastDigit <= 4 && !teen) {
    return `Ще ${count} факти не вмістилися в повідомлення.`;
  }
  return `Ще ${count} фактів не вмістилося в повідомлення.`;
};

const withTitle = (blocks: readonly string[]): string[] =>
  blocks.length === 0 ? [] : [`${FACTS_TITLE}\n${blocks[0]}`, ...blocks.slice(1)];

export const renderDumeAnswer = (result: DumeResult, repository: string): string[] => {
  const { answer } = result;
  const head = `${HEADER}\n${plain(answer.answer, DUME_ANSWER_MAX_CHARS)}`;
  const tail = [
    ...listBlock(
      'Припущення (не перевірено)',
      answer.assumptions.map(
        (item) => `${plain(item.text, DUME_NOTE_MAX_CHARS)}${problemLabel(item)}`,
      ),
    ),
    ...listBlock(
      'Невідомо',
      answer.unknowns.map((text) => plain(text, DUME_NOTE_MAX_CHARS)),
    ),
    footer(result),
  ];
  const factBlocks = answer.facts.map((fact, index) =>
    factBlock(fact, index, repository, result.commit),
  );
  const layout = (shownCount: number): string[] => [
    head,
    ...withTitle(factBlocks.slice(0, shownCount)),
    ...(shownCount < factBlocks.length ? [omittedNote(factBlocks.length - shownCount)] : []),
    ...tail,
  ];
  let shownCount = factBlocks.length;
  while (shownCount > 0 && pack(layout(shownCount)).length > DUME_MAX_MESSAGES) shownCount -= 1;
  return pack(layout(shownCount));
};

export const renderDumeFailure = (reason: DumeFailureReason): string =>
  `🔎 ${escapeHtml(DUME_FAILURE_LINE[reason])}`;

export const renderDumeNotice = (line: string): string => `🔎 ${escapeHtml(line)}`;

export const dumeMemoryText = (result: DumeResult): string =>
  `DUM-E: ${clip(stripLinks(result.answer.answer), DUME_MEMORY_ANSWER_MAX_CHARS)}`;
