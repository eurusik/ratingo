import type { OpsLogger } from '../shared/ops-logger.port';

export interface RecordingLogger extends OpsLogger {
  warnings: string[];
  debugs: string[];
}

export const recordingLogger = (): RecordingLogger => {
  const warnings: string[] = [];
  const debugs: string[] = [];
  return {
    warnings,
    debugs,
    warn: (message) => warnings.push(message),
    debug: (message) => debugs.push(message),
  };
};
