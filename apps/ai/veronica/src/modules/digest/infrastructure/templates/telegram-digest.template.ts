import { DigestBlock } from '../../domain/constants/digest-block.constants';
import { DIGEST_BLOCK_ORDER } from '../../domain/constants/digest-block.constants';
import { DigestLevel } from '../../domain/constants/digest-level.constants';
import { SOURCE_BLOCK, SOURCE_LABEL } from '../../domain/constants/digest-source.constants';
import {
  HEADLINE_MAX_CHARS as HEADLINE_MAX,
  LINE_MAX_CHARS as LINE_MAX,
} from '../../domain/constants/digest-text.constants';
import type {
  BlockReport,
  Digest,
  DigestItem,
  DigestText,
  Fact,
  RenderedMessage,
} from '../../domain/entities/digest';
import { FactUnit } from '../../domain/entities/digest';
import { SourceState } from '../../domain/entities/source-reading';
import type {
  DigestRenderInput,
  DigestRendererPort,
} from '../../domain/ports/digest-renderer.port';

export const TELEGRAM_MESSAGE_LIMIT = 4096;
const SAFE_LENGTH = 3900;
const ACTIONS_SHOWN = 8;
const NOTES_SHOWN = 8;

const LEVEL_EMOJI: Readonly<Record<DigestLevel, string>> = {
  [DigestLevel.ACTION]: '🔴',
  [DigestLevel.NOTE]: '🟡',
  [DigestLevel.OK]: '🟢',
};

const BLOCK_TITLE: Readonly<Record<DigestBlock, string>> = {
  [DigestBlock.PEOPLE]: '👥 Люди',
  [DigestBlock.JOBS]: '⚙️ Завдання',
  [DigestBlock.SERVICES]: '🔌 Сервіси',
  [DigestBlock.STORAGE]: '🗄 Дані',
};

const UNIT_SUFFIX: Readonly<Record<FactUnit, string>> = {
  [FactUnit.COUNT]: '',
  [FactUnit.HOURS]: ' год',
  [FactUnit.PERCENT]: '%',
  [FactUnit.MEGABYTES]: ' МБ',
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const clip = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const safe = (value: string, max: number): string => escapeHtml(clip(value, max));

const groupDigits = (value: number): string =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const formatValue = (value: number, unit: FactUnit): string =>
  `${groupDigits(value)}${UNIT_SUFFIX[unit]}`;

export const formatFact = (fact: Fact): string => {
  const base = `${fact.label}: ${formatValue(fact.current, fact.unit)}`;
  return fact.baseline === null
    ? base
    : `${base} (тиждень тому: ${formatValue(fact.baseline, fact.unit)})`;
};

const pluralize = (count: number, one: string, few: string, many: string): string => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  return last >= 2 && last <= 4 ? few : many;
};

const itemsOf = (digest: Digest, level: DigestLevel): DigestItem[] =>
  digest.blocks.flatMap((block) => block.items).filter((item) => item.level === level);

const defaultHeadline = (digest: Digest): string => {
  if (digest.level === DigestLevel.OK) return 'Усе спокійно, нічого робити не треба';
  if (digest.level === DigestLevel.NOTE) return 'Серйозного немає, але є що переглянути';
  const count = itemsOf(digest, DigestLevel.ACTION).length;
  return `Потрібна дія: ${count} ${pluralize(count, 'справа', 'справи', 'справ')}`;
};

const adviceFor = (item: DigestItem, text: DigestText | null): string =>
  text?.adviceById[item.id] ?? item.advice;

const factsLine = (facts: readonly Fact[]): string =>
  facts.length === 0
    ? ''
    : ` <i>${facts.map((fact) => safe(formatFact(fact), LINE_MAX)).join('; ')}</i>`;

const actionLines = (
  digest: Digest,
  text: DigestText | null,
): { lines: string[]; hidden: number } => {
  const actions = itemsOf(digest, DigestLevel.ACTION);
  const lines = actions
    .slice(0, ACTIONS_SHOWN)
    .map(
      (item, index) =>
        `${index + 1}. ${safe(adviceFor(item, text), LINE_MAX)}${factsLine(item.facts)}`,
    );
  return { lines, hidden: actions.length - lines.length };
};

const noteLines = (digest: Digest): string[] =>
  itemsOf(digest, DigestLevel.NOTE)
    .slice(0, NOTES_SHOWN)
    .map((item) => `• ${safe(item.advice, LINE_MAX)}`);

const blockHasData = (block: BlockReport, digest: Digest): boolean =>
  block.facts.length > 0 ||
  digest.sources.some(
    (status) => SOURCE_BLOCK[status.source] === block.block && status.state === SourceState.OK,
  );

const blockLine = (block: BlockReport, digest: Digest): string => {
  const title = `<b>${BLOCK_TITLE[block.block]}:</b>`;
  if (!blockHasData(block, digest)) return `${title} немає даних`;
  const worst = block.items.some((item) => item.level === DigestLevel.ACTION)
    ? 'потрібна дія'
    : block.items.length > 0
      ? 'є зауваження'
      : 'усе гаразд';
  const headlineFacts = block.facts.slice(0, 2).map((fact) => safe(formatFact(fact), LINE_MAX));
  return [title, [worst, ...headlineFacts].join('; ')].join(' ');
};

const detailLines = (digest: Digest): string[] =>
  digest.blocks
    .filter((block) => block.facts.length > 0)
    .flatMap((block) => [
      `<b>${BLOCK_TITLE[block.block]}</b>`,
      ...block.facts.map((fact) => `• ${safe(formatFact(fact), LINE_MAX)}`),
    ]);

const sourceFooter = (digest: Digest): string => {
  const parts = digest.sources.map((status) =>
    status.state === SourceState.OK
      ? `✅ ${SOURCE_LABEL[status.source]}`
      : `⚠️ ${SOURCE_LABEL[status.source]}: ${safe(status.reason ?? 'недоступно', 80)}`,
  );
  return `<i>Джерела: ${parts.join(' · ')}</i>`;
};

const costFooter = (modelCostUsd: number | null): string =>
  modelCostUsd === null
    ? '<i>Текст зібрано за шаблоном, без моделі</i>'
    : `<i>Текст від моделі · $${modelCostUsd.toFixed(4)}</i>`;

interface Sections {
  header: string;
  actions: string[];
  hiddenActions: number;
  notes: string[];
  blocks: string[];
  interesting: string | null;
  details: string[];
  footer: string[];
}

const assemble = (sections: Sections): string =>
  [
    sections.header,
    sections.actions.length > 0
      ? [
          '<b>Що зробити</b>',
          ...sections.actions,
          ...(sections.hiddenActions > 0 ? [`…і ще ${sections.hiddenActions}`] : []),
        ].join('\n')
      : null,
    sections.notes.length > 0 ? ['<b>Варто знати</b>', ...sections.notes].join('\n') : null,
    sections.blocks.join('\n'),
    sections.interesting,
    sections.details.length > 0
      ? `<blockquote expandable>${sections.details.join('\n')}</blockquote>`
      : null,
    sections.footer.join('\n'),
  ]
    .filter((part): part is string => part !== null)
    .join('\n\n');

const fitToLimit = (sections: Sections): string => {
  const reductions: ((s: Sections) => Sections)[] = [
    (s) => ({ ...s, details: [] }),
    (s) => ({ ...s, interesting: null }),
    (s) => ({ ...s, notes: [] }),
    (s) => ({ ...s, blocks: [] }),
  ];
  let current = sections;
  for (const reduce of reductions) {
    if (assemble(current).length <= SAFE_LENGTH) break;
    current = reduce(current);
  }
  while (assemble(current).length > SAFE_LENGTH && current.actions.length > 1) {
    current = {
      ...current,
      actions: current.actions.slice(0, -1),
      hiddenActions: current.hiddenActions + 1,
    };
  }
  return assemble(current);
};

export class TelegramDigestTemplate implements DigestRendererPort {
  render({ digest, text, modelCostUsd }: DigestRenderInput): RenderedMessage {
    const headline = text?.headline ?? defaultHeadline(digest);
    const actions = actionLines(digest, text);
    const sections: Sections = {
      header: `${LEVEL_EMOJI[digest.level]} <b>${safe(headline, HEADLINE_MAX)}</b>`,
      actions: actions.lines,
      hiddenActions: actions.hidden,
      notes: noteLines(digest),
      blocks: DIGEST_BLOCK_ORDER.map((order) =>
        digest.blocks.find((b) => b.block === order),
      ).flatMap((block) => (block === undefined ? [] : [blockLine(block, digest)])),
      interesting:
        text?.interesting === undefined ? null : `💡 ${safe(text.interesting, LINE_MAX)}`,
      details: detailLines(digest),
      footer: [sourceFooter(digest), costFooter(text === null ? null : modelCostUsd)],
    };
    return { html: fitToLimit(sections), silent: digest.level === DigestLevel.OK };
  }
}
