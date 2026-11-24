export const GRAFANA_CONFIG = Symbol('GRAFANA_CONFIG');
export const TELEGRAM_CONFIG = Symbol('TELEGRAM_CONFIG');
export const INFRA_CONFIG = Symbol('INFRA_CONFIG');
export const MODEL_ALIASES = Symbol('MODEL_ALIASES');
export const ANTHROPIC_CONFIG = Symbol('ANTHROPIC_CONFIG');
export const CHAT_CONFIG = Symbol('CHAT_CONFIG');
export const PRODUCT_STATS_CONFIG = Symbol('PRODUCT_STATS_CONFIG');
export const CHANGES_CONFIG = Symbol('CHANGES_CONFIG');
export const HAPPY_CONFIG = Symbol('HAPPY_CONFIG');
export const ANALYTICS_MCP_CONFIG = Symbol('ANALYTICS_MCP_CONFIG');

export interface GrafanaConfig {
  baseUrl?: string;
  token?: string;
}

export interface AnthropicConfig {
  apiKey?: string;
}

export interface ProductStatsConfig {
  readerDatabaseUrl?: string;
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

export interface ChatConfig {
  allowedUserIds: readonly string[];
  webhookUrl?: string;
}

export interface ChangesConfig {
  token?: string;
  repository: string;
}

export interface HappyConfig {
  internalUrl?: string;
  serviceToken?: string;
  repository: string;
}

export interface AnalyticsMcpConfig {
  credentialsJson?: string;
  propertyId?: string;
}
