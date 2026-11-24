import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { CHAT_CONFIG, type ChatConfig } from '../../../../config/config.constants';
import { WEBHOOK_ADMIN_PORT, type WebhookAdminPort } from '../../../notify/public';
import { WEBHOOK_ALLOWED_UPDATES } from '../../domain/constants/chat.constants';
import {
  WebhookDecision,
  decideWebhookRegistration,
} from '../../domain/policies/webhook-registration.policy';
import {
  WEBHOOK_SECRET_PORT,
  type WebhookSecretPort,
} from '../../domain/ports/webhook-secret.port';

@Injectable()
export class WebhookRegistrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WebhookRegistrationService.name);

  constructor(
    @Inject(WEBHOOK_ADMIN_PORT) private readonly admin: WebhookAdminPort,
    @Inject(WEBHOOK_SECRET_PORT) private readonly secret: WebhookSecretPort,
    @Inject(CHAT_CONFIG) private readonly config: ChatConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.register();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'невідома помилка';
      this.logger.error(`Вебхук Telegram не зареєстровано: ${reason}`);
    }
  }

  async register(): Promise<WebhookDecision | null> {
    const url = this.config.webhookUrl;
    if (url === undefined) {
      return null;
    }
    const allowedUpdates = [...WEBHOOK_ALLOWED_UPDATES];
    const decision = decideWebhookRegistration(await this.admin.getWebhookInfo(), {
      url,
      allowedUpdates,
    });
    if (decision === WebhookDecision.REGISTER) {
      await this.admin.setWebhook({
        url,
        secretToken: this.secret.value,
        allowedUpdates,
        dropPendingUpdates: false,
      });
      this.logger.log(`Вебхук Telegram зареєстровано: ${url}`);
    } else {
      this.logger.log('Вебхук Telegram уже актуальний');
    }
    return decision;
  }
}
