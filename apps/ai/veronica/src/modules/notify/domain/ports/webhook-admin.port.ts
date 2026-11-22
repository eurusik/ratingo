export interface WebhookInfo {
  url: string;
  allowedUpdates: string[] | null;
}

export interface WebhookRegistration {
  url: string;
  secretToken: string;
  allowedUpdates: string[];
  dropPendingUpdates: boolean;
}

export interface WebhookAdminPort {
  getWebhookInfo(): Promise<WebhookInfo>;
  setWebhook(registration: WebhookRegistration): Promise<void>;
}

export const WEBHOOK_ADMIN_PORT = Symbol('WEBHOOK_ADMIN_PORT');
