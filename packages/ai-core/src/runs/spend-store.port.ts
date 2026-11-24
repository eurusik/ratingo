export interface SpendStore {
  add(key: string, usd: number, ttlSeconds: number): Promise<void>;
  total(key: string): Promise<number>;
}

export interface SpendLogger {
  warn(message: string): void;
}
