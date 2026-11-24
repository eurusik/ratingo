export const GITHUB_CONFIG = Symbol('GITHUB_CONFIG');
export const INFRA_CONFIG = Symbol('INFRA_CONFIG');
export const MODEL_ALIASES = Symbol('MODEL_ALIASES');
export const ANTHROPIC_CONFIG = Symbol('ANTHROPIC_CONFIG');
export const REVIEW_CONFIG = Symbol('REVIEW_CONFIG');
export const REDIS_CONFIG = Symbol('REDIS_CONFIG');
export const WEBHOOK_CONFIG = Symbol('WEBHOOK_CONFIG');

export type GithubAuthConfig =
  { kind: 'token'; token: string } | { kind: 'app'; appId: string; privateKey: string };

export interface GithubConfig {
  auth: GithubAuthConfig;
  apiUrl: string;
}

export interface WebhookConfig {
  secret: string;
}

export interface AnthropicConfig {
  apiKey?: string;
}

export interface RedisConfig {
  url?: string;
}

export interface InfraConfig {
  port: number;
}

export interface ReviewConfig {
  allowedRepositories: string[];
  allowedAuthors: string[];
  mentionHandle: string;
  serviceToken?: string;
}
