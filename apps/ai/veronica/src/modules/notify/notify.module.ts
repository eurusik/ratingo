import { Module } from '@nestjs/common';

import { TELEGRAM_CONFIG, type TelegramConfig } from '../../config/config.constants';

import { NOTIFIER_PORT } from './domain/ports/notifier.port';
import { TelegramNotifierAdapter } from './infrastructure/adapters/telegram.notifier-adapter';

@Module({
  providers: [
    {
      provide: NOTIFIER_PORT,
      inject: [TELEGRAM_CONFIG],
      useFactory: (config: TelegramConfig) => new TelegramNotifierAdapter(config),
    },
  ],
  exports: [NOTIFIER_PORT],
})
export class NotifyModule {}
