import { gzipSync } from 'node:zlib';

const EXPORT_TIMEOUT_MS = 10_000;
const EXPORT_RETRY_DELAY_MS = 2_000;
const EXPORT_ATTEMPTS = 3;
const NANOS_SUFFIX_PER_MILLI = '000000';
const MAX_MESSAGE_LENGTH = 8_000;
const REDACTED = '[REDACTED]';
const LOGGER_CONTEXT = 'backup';

const SEVERITY_NUMBER = { info: 9, warn: 13, error: 17 } as const;

type Level = keyof typeof SEVERITY_NUMBER;

const URL_CREDENTIALS = /\b([A-Za-z][A-Za-z0-9+.-]{1,20}:\/\/)[^\s/:@]{1,128}:[^\s/@]{1,256}@/g;

const REDACTION_RULES: readonly RegExp[] = [
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\b[A-Za-z0-9_]{0,40}?(?:api[_-]?key|token|secret|password|passwd|access[_-]?key)["']?\s*[:=]\s*["']?[^\s"',;&]{4,}/gi,
  /\bAKIA[A-Z0-9]{16}\b/g,
  /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g,
];

export interface StructuredConsoleSettings {
  service: string;
  environment: string;
  otlpEndpoint?: string;
}

interface LogLine {
  time: string;
  level: Level;
  service: string;
  environment: string;
  context: string;
  message: string;
}

export interface StructuredConsoleDeps {
  write?: (line: string) => void;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export const redactSecrets = (text: string): string =>
  REDACTION_RULES.reduce(
    (redacted, rule) => redacted.replace(rule, REDACTED),
    text.replace(URL_CREDENTIALS, `$1${REDACTED}@`),
  );

const describe = (args: unknown[]): string =>
  args.map((arg) => (arg instanceof Error ? (arg.stack ?? arg.message) : String(arg))).join(' ');

export class StructuredConsole implements Pick<Console, 'log' | 'warn' | 'error'> {
  private readonly lines: LogLine[] = [];
  private readonly write: (line: string) => void;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly settings: StructuredConsoleSettings,
    deps: StructuredConsoleDeps = {},
  ) {
    this.write = deps.write ?? ((line) => void process.stdout.write(line));
    this.now = deps.now ?? (() => new Date());
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.sleep = deps.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  }

  log = (...args: unknown[]): void => this.record('info', args);

  warn = (...args: unknown[]): void => this.record('warn', args);

  error = (...args: unknown[]): void => this.record('error', args);

  async flush(): Promise<void> {
    const { otlpEndpoint } = this.settings;
    if (!otlpEndpoint || this.lines.length === 0) {
      return;
    }
    const batch = this.lines.splice(0);
    const reason = await this.exportWithRetries(otlpEndpoint, batch);
    if (reason) {
      this.write(
        `${JSON.stringify({ ...this.line('warn', `Log export failed: ${reason}`), lostRecords: batch.length })}\n`,
      );
    }
  }

  private record(level: Level, args: unknown[]): void {
    const line = this.line(level, describe(args));
    this.lines.push(line);
    this.write(`${JSON.stringify(line)}\n`);
  }

  private line(level: Level, message: string): LogLine {
    return {
      time: this.now().toISOString(),
      level,
      service: this.settings.service,
      environment: this.settings.environment,
      context: LOGGER_CONTEXT,
      message: redactSecrets(message).slice(0, MAX_MESSAGE_LENGTH),
    };
  }

  private async exportWithRetries(endpoint: string, batch: LogLine[]): Promise<string | undefined> {
    let failure: string | undefined;
    for (let attempt = 1; attempt <= EXPORT_ATTEMPTS; attempt += 1) {
      failure = await this.exportOnce(endpoint, batch);
      if (failure === undefined) {
        return undefined;
      }
      if (attempt < EXPORT_ATTEMPTS) {
        await this.sleep(EXPORT_RETRY_DELAY_MS);
      }
    }
    return failure;
  }

  private async exportOnce(endpoint: string, batch: LogLine[]): Promise<string | undefined> {
    try {
      const response = await this.fetchImpl(`${endpoint.replace(/\/+$/, '')}/v1/logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
        body: gzipSync(JSON.stringify(this.payload(batch))),
        signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
      });
      await response.body?.cancel().catch(() => undefined);
      return response.ok ? undefined : `HTTP ${response.status}`;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private payload(batch: LogLine[]) {
    const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });
    return {
      resourceLogs: [
        {
          resource: {
            attributes: [
              attribute('service.name', this.settings.service),
              attribute('deployment.environment.name', this.settings.environment),
            ],
          },
          scopeLogs: [
            {
              scope: { name: 'ratingo.logger' },
              logRecords: batch.map((line) => ({
                timeUnixNano: `${Date.parse(line.time)}${NANOS_SUFFIX_PER_MILLI}`,
                severityNumber: SEVERITY_NUMBER[line.level],
                severityText: line.level,
                body: { stringValue: JSON.stringify(line) },
                attributes: [attribute('context', line.context)],
              })),
            },
          ],
        },
      ],
    };
  }
}
