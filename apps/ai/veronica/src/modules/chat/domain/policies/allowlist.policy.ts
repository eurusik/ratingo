import { PRIVATE_CHAT_TYPE } from '../constants/chat.constants';

export interface Allowlist {
  userIds: readonly string[];
  chatId: string;
}

export interface Sender {
  userId: string;
  chatId: string;
  chatType: string;
}

export const isAllowed = (sender: Sender, allowlist: Allowlist): boolean =>
  allowlist.userIds.includes(sender.userId) &&
  sender.chatId === allowlist.chatId &&
  sender.chatType === PRIVATE_CHAT_TYPE;
