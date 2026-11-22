import { and, eq } from 'drizzle-orm';

import type { Database } from '../../../../database/database.module';
import { digestDeliveries } from '../../../../database/schema';
import type { DigestDeliveryProbePort } from '../../domain/ports/watchdog.ports';

const SENT = 'sent';

export class PostgresDigestDeliveryProbe implements DigestDeliveryProbePort {
  constructor(private readonly db: Database) {}

  async isSentOn(date: string): Promise<boolean> {
    const rows = await this.db
      .select({ date: digestDeliveries.digestDate })
      .from(digestDeliveries)
      .where(and(eq(digestDeliveries.digestDate, date), eq(digestDeliveries.status, SENT)))
      .limit(1);
    return rows.length > 0;
  }
}
