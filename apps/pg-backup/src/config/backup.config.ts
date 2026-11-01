import { MS_PER_SECOND } from '../domain';
import { BackupConfigError } from './backup-config.error';

export interface BackupConfig {
  databaseUrl: string;
  filePrefix: string;
  uploadRetryDelaysMs: number[];
  s3: {
    bucket: string;
    region: string;
    endpoint?: string;
    forcePathStyle: boolean;
    accessKeyId: string;
    secretAccessKey: string;
  };
  metrics: {
    otlpEndpoint?: string;
    serviceName: string;
    environmentName: string;
  };
}

const REQUIRED_VARIABLES = [
  'BACKUP_DATABASE_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
  'AWS_S3_REGION',
] as const;

const DEFAULT_UPLOAD_RETRY_DELAYS_SECONDS = [30, 60, 120, 240, 480];

export function loadBackupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig {
  const missing = REQUIRED_VARIABLES.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new BackupConfigError(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    databaseUrl: env.BACKUP_DATABASE_URL!,
    filePrefix: env.BACKUP_FILE_PREFIX || 'backup',
    uploadRetryDelaysMs: parseRetryDelaysSeconds(env.UPLOAD_RETRY_DELAYS_SECONDS).map(
      (seconds) => seconds * MS_PER_SECOND,
    ),
    s3: {
      bucket: env.AWS_S3_BUCKET!,
      region: env.AWS_S3_REGION!,
      endpoint: env.AWS_S3_ENDPOINT || undefined,
      forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE === 'true',
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
    metrics: {
      otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
      serviceName: env.OTEL_SERVICE_NAME || 'ratingo-backup',
      environmentName: env.RAILWAY_ENVIRONMENT_NAME || 'development',
    },
  };
}

function parseRetryDelaysSeconds(raw: string | undefined): number[] {
  if (!raw) return DEFAULT_UPLOAD_RETRY_DELAYS_SECONDS;
  const delays = raw.split(',').map((part) => Number(part.trim()));
  if (delays.some((delay) => !Number.isFinite(delay) || delay < 0)) {
    throw new BackupConfigError(
      `UPLOAD_RETRY_DELAYS_SECONDS must be comma-separated non-negative numbers, got "${raw}"`,
    );
  }
  return delays;
}
