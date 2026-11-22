import type { TelegramConfig } from '../../../../config/config.constants';
import type { NotificationMessage, NotifierPort } from '../../domain/ports/notifier.port';
import { NotificationError } from '../../domain/ports/notifier.port';

const TELEGRAM_API = 'https://api.telegram.org';
const SEND_TIMEOUT_MS = 15_000;

interface TelegramReply {
  ok: boolean;
  description?: string;
}

export class TelegramNotifierAdapter implements NotifierPort {
  constructor(
    private readonly config: TelegramConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: NotificationMessage): Promise<void> {
    const response = await this.post(message);
    const reply = await this.readReply(response);
    if (!response.ok || !reply.ok) {
      throw new NotificationError(
        `Telegram відхилив повідомлення (HTTP ${response.status}): ${reply.description ?? 'без опису'}`,
      );
    }
  }

  private async post(message: NotificationMessage): Promise<Response> {
    try {
      return await this.fetchImpl(`${TELEGRAM_API}/bot${this.config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message.html,
          parse_mode: 'HTML',
          disable_notification: message.silent,
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      throw new NotificationError(`Не вдалося звернутися до Telegram (${reason})`);
    }
  }

  private async readReply(response: Response): Promise<TelegramReply> {
    try {
      return (await response.json()) as TelegramReply;
    } catch {
      return { ok: false };
    }
  }
}
