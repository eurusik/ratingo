import type { OpsLogger } from '../shared/ops-logger.port';

export interface RecordingLogger extends OpsLogger {
  warnings: string[];
}

export const recordingLogger = (): RecordingLogger => {
  const warnings: string[] = [];
  return { warnings, warn: (message) => warnings.push(message) };
};
