import { NotificationError } from '../../domain/ports/notifier.port';

const TELEGRAM_API = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 15_000;

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

const isRetryableStatus = (status: number): boolean =>
  status === HTTP_TOO_MANY_REQUESTS ||
  status < HTTP_CLIENT_ERROR_MIN ||
  status >= HTTP_SERVER_ERROR_MIN;

export interface TelegramReply<Result = unknown> {
  ok: boolean;
  description?: string;
  result?: Result;
}

export interface TelegramResponse<Result = unknown> {
  status: number;
  reply: TelegramReply<Result>;
}

export class TelegramApiClient {
  constructor(
    private readonly botToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call<Result = unknown>(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<TelegramResponse<Result>> {
    const response = await this.post(method, payload);
    return { status: response.status, reply: await this.readReply<Result>(response) };
  }

  async callOrThrow<Result = unknown>(
    method: string,
    payload: Record<string, unknown>,
    failureLabel: string,
  ): Promise<Result | undefined> {
    const { status, reply } = await this.call<Result>(method, payload);
    if (status >= HTTP_OK_MIN && status <= HTTP_OK_MAX && reply.ok) {
      return reply.result;
    }
    throw new NotificationError(
      `${failureLabel} (HTTP ${status}): ${reply.description ?? 'без опису'}`,
      isRetryableStatus(status),
    );
  }

  private async post(method: string, payload: Record<string, unknown>): Promise<Response> {
    try {
      return await this.fetchImpl(`${TELEGRAM_API}/bot${this.botToken}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      throw new NotificationError(`Не вдалося звернутися до Telegram (${reason})`, true, true);
    }
  }

  private async readReply<Result>(response: Response): Promise<TelegramReply<Result>> {
    try {
      return (await response.json()) as TelegramReply<Result>;
    } catch {
      return { ok: false };
    }
  }
}
