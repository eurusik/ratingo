import { eq } from 'drizzle-orm';

import type { Database } from '../../../../database/database.module';
import { digestDeliveries } from '../../../../database/schema';
import type {
  DigestDelivery,
  DigestDeliveryRepository,
} from '../../domain/ports/digest-delivery.repository';

export class PostgresDigestDeliveryRepository implements DigestDeliveryRepository {
  constructor(private readonly db: Database) {}

  async wasSent(date: string): Promise<boolean> {
    const rows = await this.db
      .select({ date: digestDeliveries.digestDate })
      .from(digestDeliveries)
      .where(eq(digestDeliveries.digestDate, date))
      .limit(1);
    return rows.length > 0;
  }

  async markSent(delivery: DigestDelivery): Promise<void> {
    await this.db
      .insert(digestDeliveries)
      .values({
        digestDate: delivery.date,
        sentAtMs: delivery.sentAtMs,
        silent: delivery.silent,
        runId: delivery.runId,
      })
      .onConflictDoNothing();
  }
}
