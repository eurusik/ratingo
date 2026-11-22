import type { ChatConfig } from './config.constants';

interface ChatEnv {
  TELEGRAM_CHAT_ID: string;
  TELEGRAM_ALLOWED_USER_IDS?: string;
  TELEGRAM_WEBHOOK_URL?: string;
}

export const buildChatConfig = (env: ChatEnv): ChatConfig => ({
  allowedUserIds:
    env.TELEGRAM_ALLOWED_USER_IDS === undefined
      ? [env.TELEGRAM_CHAT_ID]
      : env.TELEGRAM_ALLOWED_USER_IDS.split(',').map((id) => id.trim()),
  ...(env.TELEGRAM_WEBHOOK_URL === undefined ? {} : { webhookUrl: env.TELEGRAM_WEBHOOK_URL }),
});
