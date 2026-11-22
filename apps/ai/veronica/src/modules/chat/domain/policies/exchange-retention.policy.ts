import { EXCHANGE_RETENTION_MS } from '../constants/exchange.constants';

export const exchangeRetentionCutoffMs = (
  nowMs: number,
  retentionMs: number = EXCHANGE_RETENTION_MS,
): number => nowMs - retentionMs;
