import type { LogRecord } from './log-record';

export interface LogShipper {
  enqueue(record: LogRecord): void;
  flush(): Promise<void>;
}
