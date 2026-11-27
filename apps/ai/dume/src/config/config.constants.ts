export const MODEL_ALIASES = Symbol('MODEL_ALIASES');
export const ANTHROPIC_CONFIG = Symbol('ANTHROPIC_CONFIG');
export const REDIS_CONFIG = Symbol('REDIS_CONFIG');
export const SNAPSHOT_CONFIG = Symbol('SNAPSHOT_CONFIG');

export interface AnthropicConfig {
  apiKey?: string;
}

export interface RedisConfig {
  url?: string;
}

export type SnapshotConfig =
  | { kind: 'github'; repository: string; apiUrl: string; token?: string }
  | { kind: 'local'; root: string };
