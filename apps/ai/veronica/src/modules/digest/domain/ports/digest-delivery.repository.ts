export interface DigestDelivery {
  date: string;
  sentAtMs: number;
  silent: boolean;
  runId: string | null;
}

export interface DigestDeliveryRepository {
  claim(date: string, nowMs: number, staleAfterMs: number): Promise<boolean>;
  markSent(delivery: DigestDelivery): Promise<void>;
  release(date: string): Promise<void>;
}

export const DIGEST_DELIVERY_REPOSITORY = Symbol('DIGEST_DELIVERY_REPOSITORY');
