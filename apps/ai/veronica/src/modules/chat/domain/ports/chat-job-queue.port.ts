import type { HappyFollowUp } from '../entities/happy';
import type { IncomingMessage } from '../entities/incoming-message';

export interface ChatJobQueuePort {
  enqueue(message: IncomingMessage): Promise<void>;
  scheduleHappyFollowUp(followUp: HappyFollowUp, delayMs: number): Promise<void>;
}

export const CHAT_JOB_QUEUE = Symbol('CHAT_JOB_QUEUE');
