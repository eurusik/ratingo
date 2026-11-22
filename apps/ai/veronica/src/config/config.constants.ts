export const GRAFANA_CONFIG = Symbol('GRAFANA_CONFIG');
export const TELEGRAM_CONFIG = Symbol('TELEGRAM_CONFIG');
export const INFRA_CONFIG = Symbol('INFRA_CONFIG');
export const MODEL_ALIASES = Symbol('MODEL_ALIASES');

export interface GrafanaConfig {
  baseUrl?: string;
  token?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface InfraConfig {
  databaseUrl: string;
  redisUrl: string;
  port: number;
}
