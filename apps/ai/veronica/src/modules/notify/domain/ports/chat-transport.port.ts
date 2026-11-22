export const ChatAction = {
  TYPING: 'typing',
} as const;
export type ChatAction = (typeof ChatAction)[keyof typeof ChatAction];

export interface ChatTransportPort {
  sendMessage(chatId: string, html: string): Promise<void>;
  postMessage(chatId: string, html: string): Promise<number>;
  editMessage(chatId: string, messageId: number, html: string): Promise<void>;
  sendChatAction(chatId: string, action: ChatAction): Promise<void>;
}

export const CHAT_TRANSPORT = Symbol('CHAT_TRANSPORT');
