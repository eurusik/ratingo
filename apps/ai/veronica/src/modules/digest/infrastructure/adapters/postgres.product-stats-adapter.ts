import type { OnApplicationShutdown } from '@nestjs/common';

import type postgres from 'postgres';

import { connectReportingDatabase } from '../../../../database/reporting-connection';
import { BASELINE_OFFSET_DAYS, MS_PER_DAY } from '../../digest.constants';
import { kyivDateOf } from '../../domain/kyiv-day';
import { measured } from '../../domain/entities/measured';
import type { ProductStats } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available } from '../../domain/entities/source-reading';
import {
  SeriesMetric,
  type DailyValue,
  type ProductSeriesPort,
} from '../../domain/ports/product-series.port';
import type { ProductStatsPort } from '../../domain/ports/product-stats.port';

interface DayTotal {
  day: string;
  total: number;
}

const READER_CONNECTIONS = 2;

const totalOn = (rows: readonly DayTotal[], day: string): number =>
  rows.find((row) => row.day === day)?.total ?? 0;

export class PostgresProductStatsAdapter
  implements ProductStatsPort, ProductSeriesPort, OnApplicationShutdown
{
  static connect(readerDatabaseUrl: string): PostgresProductStatsAdapter {
    return new PostgresProductStatsAdapter(
      connectReportingDatabase(readerDatabaseUrl, READER_CONNECTIONS),
    );
  }

  constructor(private readonly sql: postgres.Sql) {}

  async read(windowEndMs: number): Promise<SourceReading<ProductStats>> {
    const day = kyivDateOf(windowEndMs - MS_PER_DAY);
    const baselineDay = kyivDateOf(windowEndMs - (1 + BASELINE_OFFSET_DAYS) * MS_PER_DAY);
    const [signups, actions, history] = await Promise.all([
      this.sql<DayTotal[]>`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, new_users AS total
        FROM reporting.daily_new_users
        WHERE day IN (${day}::date, ${baselineDay}::date)`,
      this.sql<DayTotal[]>`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(actions)::integer AS total
        FROM reporting.daily_user_actions
        WHERE day IN (${day}::date, ${baselineDay}::date)
        GROUP BY day`,
      this.sql<{ first_day: string | null }[]>`
        SELECT to_char(min(day), 'YYYY-MM-DD') AS first_day
        FROM reporting.daily_new_users`,
    ]);
    const firstDay = history[0]?.first_day ?? null;
    const hasBaseline = firstDay !== null && firstDay <= baselineDay;
    return available({
      newUsers: measured(totalOn(signups, day), hasBaseline ? totalOn(signups, baselineDay) : null),
      actions: measured(totalOn(actions, day), hasBaseline ? totalOn(actions, baselineDay) : null),
    });
  }

  async series(
    metric: SeriesMetric,
    firstDay: string,
    lastDay: string,
  ): Promise<SourceReading<DailyValue[]>> {
    const rows = await this.seriesRows(metric, firstDay, lastDay);
    return available(rows.map((row) => ({ day: row.day, value: row.total })));
  }

  private seriesRows(metric: SeriesMetric, firstDay: string, lastDay: string): Promise<DayTotal[]> {
    switch (metric) {
      case SeriesMetric.NEW_USERS:
        return this.sql<DayTotal[]>`
          SELECT to_char(day, 'YYYY-MM-DD') AS day, new_users AS total
          FROM reporting.daily_new_users
          WHERE day BETWEEN ${firstDay}::date AND ${lastDay}::date
          ORDER BY day`;
      case SeriesMetric.ACTIONS:
        return this.sql<DayTotal[]>`
          SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(actions)::integer AS total
          FROM reporting.daily_user_actions
          WHERE day BETWEEN ${firstDay}::date AND ${lastDay}::date
          GROUP BY day
          ORDER BY day`;
      case SeriesMetric.ACTIVE_USERS:
        return this.sql<DayTotal[]>`
          SELECT to_char(day, 'YYYY-MM-DD') AS day, active_users AS total
          FROM reporting.daily_active_users
          WHERE day BETWEEN ${firstDay}::date AND ${lastDay}::date
          ORDER BY day`;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.sql.end();
  }
}
