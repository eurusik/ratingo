export const MONITORED_PROVIDER = {
  TMDB: 'tmdb',
  TRAKT: 'trakt',
  MDBLIST: 'mdblist',
  OMDB: 'omdb',
  S3: 's3',
} as const;

export type MonitoredProvider = (typeof MONITORED_PROVIDER)[keyof typeof MONITORED_PROVIDER];

export const MONITORED_PROVIDERS: readonly MonitoredProvider[] = Object.values(MONITORED_PROVIDER);

export function isMonitoredProvider(value: string): value is MonitoredProvider {
  return (MONITORED_PROVIDERS as readonly string[]).includes(value);
}
