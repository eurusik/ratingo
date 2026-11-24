import type { TelegramConfig } from '../../../../config/config.constants';
import type { ChatAction, ChatTransportPort } from '../../domain/ports/chat-transport.port';
import type {
  WebhookAdminPort,
  WebhookInfo,
  WebhookRegistration,
} from '../../domain/ports/webhook-admin.port';
import { NotificationError } from '../../domain/ports/notifier.port';
import { sanitizeTelegramHtml } from '../../domain/policies/telegram-html.policy';

import { TelegramApiClient } from './telegram-api.client';

interface TelegramSentMessage {
  message_id?: number;
}

interface TelegramWebhookInfo {
  url?: string;
  allowed_updates?: string[];
}

export class TelegramChatAdapter implements ChatTransportPort, WebhookAdminPort {
  private readonly api: TelegramApiClient;

  constructor(config: Pick<TelegramConfig, 'botToken'>, fetchImpl: typeof fetch = fetch) {
    this.api = new TelegramApiClient(config.botToken, fetchImpl);
  }

  async sendMessage(chatId: string, html: string): Promise<void> {
    await this.deliver(chatId, html);
  }

  async postMessage(chatId: string, html: string): Promise<number> {
    const sent = await this.deliver(chatId, html);
    if (sent?.message_id === undefined) {
      throw new NotificationError('Telegram не повернув номер повідомлення', false);
    }
    return sent.message_id;
  }

  async editMessage(chatId: string, messageId: number, html: string): Promise<void> {
    await this.api.callOrThrow(
      'editMessageText',
      {
        chat_id: chatId,
        message_id: messageId,
        text: sanitizeTelegramHtml(html),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
      'Telegram відхилив зміну відповіді',
    );
  }

  async sendChatAction(chatId: string, action: ChatAction): Promise<void> {
    await this.api.callOrThrow(
      'sendChatAction',
      { chat_id: chatId, action },
      'Telegram відхилив індикатор дії',
    );
  }

  private deliver(chatId: string, html: string): Promise<TelegramSentMessage | undefined> {
    return this.api.callOrThrow<TelegramSentMessage>(
      'sendMessage',
      {
        chat_id: chatId,
        text: sanitizeTelegramHtml(html),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
      'Telegram відхилив відповідь',
    );
  }

  async getWebhookInfo(): Promise<WebhookInfo> {
    const info = await this.api.callOrThrow<TelegramWebhookInfo>(
      'getWebhookInfo',
      {},
      'Telegram не віддав стан вебхука',
    );
    return { url: info?.url ?? '', allowedUpdates: info?.allowed_updates ?? null };
  }

  async setWebhook(registration: WebhookRegistration): Promise<void> {
    await this.api.callOrThrow(
      'setWebhook',
      {
        url: registration.url,
        secret_token: registration.secretToken,
        allowed_updates: registration.allowedUpdates,
        drop_pending_updates: registration.dropPendingUpdates,
      },
      'Telegram відхилив реєстрацію вебхука',
    );
  }
}
