export interface DigestDelivery {
  date: string;
  sentAtMs: number;
  silent: boolean;
  runId: string | null;
}

export interface DigestDeliveryRepository {
  wasSent(date: string): Promise<boolean>;
  markSent(delivery: DigestDelivery): Promise<void>;
}

export const DIGEST_DELIVERY_REPOSITORY = Symbol('DIGEST_DELIVERY_REPOSITORY');
