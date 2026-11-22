export interface RunLogger {
  info(event: string, fields: Record<string, unknown>): void;
}
