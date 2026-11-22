import { and, eq, lt, ne, sql } from 'drizzle-orm';

import type { Database } from '../../../../database/database.module';
import { digestDeliveries } from '../../../../database/schema';
import type {
  DigestDelivery,
  DigestDeliveryRepository,
} from '../../domain/ports/digest-delivery.repository';

const CLAIMED = 'claimed';
const SENDING = 'sending';
const SENT = 'sent';

export class PostgresDigestDeliveryRepository implements DigestDeliveryRepository {
  constructor(private readonly db: Database) {}

  async claim(date: string, nowMs: number, staleAfterMs: number): Promise<boolean> {
    const claimed = await this.db
      .insert(digestDeliveries)
      .values({ digestDate: date, status: CLAIMED, claimedAtMs: nowMs })
      .onConflictDoUpdate({
        target: digestDeliveries.digestDate,
        set: { claimedAtMs: nowMs },
        setWhere: and(
          eq(digestDeliveries.status, CLAIMED),
          lt(digestDeliveries.claimedAtMs, sql`${nowMs - staleAfterMs}`),
        ),
      })
      .returning({ date: digestDeliveries.digestDate });
    return claimed.length > 0;
  }

  async markSending(date: string): Promise<void> {
    await this.db
      .update(digestDeliveries)
      .set({ status: SENDING })
      .where(eq(digestDeliveries.digestDate, date));
  }

  async markSent(delivery: DigestDelivery): Promise<void> {
    await this.db
      .update(digestDeliveries)
      .set({
        status: SENT,
        sentAtMs: delivery.sentAtMs,
        silent: delivery.silent,
        runId: delivery.runId,
      })
      .where(eq(digestDeliveries.digestDate, delivery.date));
  }

  async release(date: string): Promise<void> {
    await this.db
      .delete(digestDeliveries)
      .where(and(eq(digestDeliveries.digestDate, date), ne(digestDeliveries.status, SENT)));
  }
}
