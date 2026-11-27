import postgres from 'postgres';

const QUERY_TIMEOUT_SECONDS = 15;
const MS_PER_SECOND = 1000;

export const connectReportingDatabase = (readerDatabaseUrl: string, maxConnections: number) =>
  postgres(readerDatabaseUrl, {
    max: maxConnections,
    connect_timeout: QUERY_TIMEOUT_SECONDS,
    connection: { statement_timeout: QUERY_TIMEOUT_SECONDS * MS_PER_SECOND },
  });
