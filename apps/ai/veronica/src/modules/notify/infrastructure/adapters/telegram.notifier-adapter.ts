import type { TelegramConfig } from '../../../../config/config.constants';
import type { NotificationMessage, NotifierPort } from '../../domain/ports/notifier.port';

import { TelegramApiClient } from './telegram-api.client';

export class TelegramNotifierAdapter implements NotifierPort {
  private readonly api: TelegramApiClient;

  constructor(
    private readonly config: TelegramConfig,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.api = new TelegramApiClient(config.botToken, fetchImpl);
  }

  async send(message: NotificationMessage): Promise<void> {
    await this.api.callOrThrow(
      'sendMessage',
      {
        chat_id: this.config.chatId,
        text: message.html,
        parse_mode: 'HTML',
        disable_notification: message.silent,
        link_preview_options: { is_disabled: true },
      },
      'Telegram відхилив повідомлення',
    );
  }
}
