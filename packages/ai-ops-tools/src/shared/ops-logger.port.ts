export interface OpsLogger {
  warn(message: string): void;
  debug?(message: string): void;
}
