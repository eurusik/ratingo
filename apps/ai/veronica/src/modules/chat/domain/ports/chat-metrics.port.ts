import type { ChatOutcome, ChatRoute, CommandLabel } from '../constants/chat.constants';

export interface ChatEvent {
  outcome: ChatOutcome;
  command: CommandLabel;
  route: ChatRoute;
}

export interface ChatMetricsPort {
  record(event: ChatEvent): void;
}

export const CHAT_METRICS_PORT = Symbol('CHAT_METRICS_PORT');
