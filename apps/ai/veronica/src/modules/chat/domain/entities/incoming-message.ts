export interface IncomingMessage {
  updateId: number;
  userId: string;
  chatId: string;
  chatType: string;
  text: string;
}
