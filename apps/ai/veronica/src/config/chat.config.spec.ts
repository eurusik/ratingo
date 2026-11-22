import { buildChatConfig } from './chat.config';

describe('buildChatConfig', () => {
  it('defaults the allowlist to the owner chat', () => {
    expect(buildChatConfig({ TELEGRAM_CHAT_ID: '7' })).toEqual({ allowedUserIds: ['7'] });
  });

  it('splits and trims the configured user ids and keeps the webhook url', () => {
    expect(
      buildChatConfig({
        TELEGRAM_CHAT_ID: '7',
        TELEGRAM_ALLOWED_USER_IDS: '1, 2 ,3',
        TELEGRAM_WEBHOOK_URL: 'https://v.example/webhooks/telegram',
      }),
    ).toEqual({
      allowedUserIds: ['1', '2', '3'],
      webhookUrl: 'https://v.example/webhooks/telegram',
    });
  });
});
