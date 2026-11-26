export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_ALIASES: ReadonlyMap<string, LogLevel> = new Map<string, LogLevel>([
  ['verbose', 'debug'],
  ['debug', 'debug'],
  ['log', 'info'],
  ['info', 'info'],
  ['warn', 'warn'],
  ['warning', 'warn'],
  ['error', 'error'],
  ['fatal', 'error'],
]);

export const SEVERITY_NUMBER_BY_LEVEL: Readonly<Record<LogLevel, number>> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

export const isLevelEnabled = (minLevel: LogLevel, level: LogLevel): boolean =>
  LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minLevel);

export const toLogLevel = (name: string): LogLevel | undefined =>
  LEVEL_ALIASES.get(name.trim().toLowerCase());
