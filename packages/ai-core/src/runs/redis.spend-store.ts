import type { SpendStore } from './spend-store.port';

export interface RedisSpendClient {
  incrbyfloat(key: string, increment: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
}

export class RedisSpendStore implements SpendStore {
  constructor(
    private readonly client: RedisSpendClient,
    private readonly keyPrefix: string,
  ) {}

  async add(key: string, usd: number, ttlSeconds: number): Promise<void> {
    const redisKey = this.redisKey(key);
    await this.client.incrbyfloat(redisKey, usd);
    await this.client.expire(redisKey, ttlSeconds);
  }

  async total(key: string): Promise<number> {
    const stored = await this.client.get(this.redisKey(key));
    const parsed = stored === null ? 0 : Number(stored);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private redisKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }
}
