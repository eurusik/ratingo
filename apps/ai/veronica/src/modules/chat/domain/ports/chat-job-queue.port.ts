import type { IncomingMessage } from '../entities/incoming-message';

export interface ChatJobQueuePort {
  enqueue(message: IncomingMessage): Promise<void>;
}

export const CHAT_JOB_QUEUE = Symbol('CHAT_JOB_QUEUE');
