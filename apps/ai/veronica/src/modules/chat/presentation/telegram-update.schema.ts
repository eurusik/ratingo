import { z } from 'zod';

import { MESSAGE_TEXT_MAX_CHARS } from '../domain/constants/chat.constants';
import type { IncomingMessage } from '../domain/entities/incoming-message';

const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z
    .object({
      from: z.object({ id: z.number().int() }).optional(),
      chat: z.object({ id: z.number().int(), type: z.string() }),
      text: z.string().optional(),
    })
    .optional(),
});

export const toIncomingMessage = (body: unknown): IncomingMessage | null => {
  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success) return null;
  const { update_id: updateId, message } = parsed.data;
  if (message?.from === undefined || message.text === undefined) return null;
  return {
    updateId,
    userId: String(message.from.id),
    chatId: String(message.chat.id),
    chatType: message.chat.type,
    text: message.text.slice(0, MESSAGE_TEXT_MAX_CHARS).replace(/[\uD800-\uDBFF]$/, ''),
  };
};
