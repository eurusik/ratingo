import { Module } from '@nestjs/common';

import { TELEGRAM_CONFIG, type TelegramConfig } from '../../config/config.constants';

import { CHAT_TRANSPORT } from './domain/ports/chat-transport.port';
import { NOTIFIER_PORT } from './domain/ports/notifier.port';
import { WEBHOOK_ADMIN_PORT } from './domain/ports/webhook-admin.port';
import { TelegramChatAdapter } from './infrastructure/adapters/telegram.chat-adapter';
import { TelegramNotifierAdapter } from './infrastructure/adapters/telegram.notifier-adapter';

const chatAdapter = {
  inject: [TELEGRAM_CONFIG],
  useFactory: (config: TelegramConfig) => new TelegramChatAdapter(config),
};

@Module({
  providers: [
    {
      provide: NOTIFIER_PORT,
      inject: [TELEGRAM_CONFIG],
      useFactory: (config: TelegramConfig) => new TelegramNotifierAdapter(config),
    },
    { provide: CHAT_TRANSPORT, ...chatAdapter },
    { provide: WEBHOOK_ADMIN_PORT, ...chatAdapter },
  ],
  exports: [NOTIFIER_PORT, CHAT_TRANSPORT, WEBHOOK_ADMIN_PORT],
})
export class NotifyModule {}
