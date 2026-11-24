import {
  EXPORT_DRAFT_ID_LENGTH,
  EXPORT_DRAFT_ID_PREFIX,
  EXPORT_WINDOW_UNIT_MS,
  ExchangeOutcome,
} from '../constants/exchange.constants';
import type { ChatExchange, LoggedToolCall } from '../entities/chat-exchange';

const WINDOW_PATTERN = /^(\d+)([hd])$/;
const OUTCOMES: readonly string[] = Object.values(ExchangeOutcome);

export interface ExportRequest {
  sinceMs: number;
  outcomes: readonly ExchangeOutcome[];
}

export class ExportArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportArgumentError';
  }
}

export interface EvalCaseDraft {
  id: string;
  question: string;
  expectedTools: readonly string[];
  reference: { answer: string };
  fixtures: readonly never[];
  mustContain: readonly never[];
  observed: {
    outcome: ExchangeOutcome;
    route: string;
    flaggedNumbers: readonly string[];
    costUsd: number;
    createdAtMs: number;
    runId: string;
    toolCalls: readonly LoggedToolCall[];
  };
}

const optionValue = (args: readonly string[], name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const parseWindowMs = (value: string | undefined): number => {
  const match = value === undefined ? null : WINDOW_PATTERN.exec(value);
  if (match === null) {
    throw new ExportArgumentError('Потрібен --since=7d (або --since=12h)');
  }
  const unit = match[2] as keyof typeof EXPORT_WINDOW_UNIT_MS;
  return Number(match[1]) * EXPORT_WINDOW_UNIT_MS[unit];
};

const parseOutcomes = (value: string | undefined): ExchangeOutcome[] => {
  if (value === undefined || value === '') return [];
  const names = value.split(',').map((name) => name.trim());
  const unknown = names.find((name) => !OUTCOMES.includes(name));
  if (unknown !== undefined) {
    throw new ExportArgumentError(`--outcome: невідоме значення «${unknown}»`);
  }
  return names as ExchangeOutcome[];
};

export const parseExportArgs = (args: readonly string[], nowMs: number): ExportRequest => ({
  sinceMs: nowMs - parseWindowMs(optionValue(args, 'since')),
  outcomes: parseOutcomes(optionValue(args, 'outcome')),
});

export const toEvalCaseDraft = (exchange: ChatExchange): EvalCaseDraft => ({
  id: `${EXPORT_DRAFT_ID_PREFIX}${exchange.id.slice(0, EXPORT_DRAFT_ID_LENGTH)}`,
  question: exchange.question,
  expectedTools: exchange.toolNames,
  reference: { answer: exchange.answer },
  fixtures: [],
  mustContain: [],
  observed: {
    outcome: exchange.outcome,
    route: exchange.route,
    flaggedNumbers: exchange.flaggedNumbers,
    costUsd: exchange.costUsd,
    createdAtMs: exchange.createdAtMs,
    runId: exchange.runId,
    toolCalls: exchange.toolCalls,
  },
});
