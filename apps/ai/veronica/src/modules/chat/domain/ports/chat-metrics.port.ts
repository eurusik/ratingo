import type { ChatOutcome, CommandLabel } from '../constants/chat.constants';

export interface ChatEvent {
  outcome: ChatOutcome;
  command: CommandLabel;
}

export interface ChatMetricsPort {
  record(event: ChatEvent): void;
}

export const CHAT_METRICS_PORT = Symbol('CHAT_METRICS_PORT');
