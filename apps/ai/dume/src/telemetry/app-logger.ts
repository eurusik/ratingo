import {
  createNestLogger,
  type NestCompatibleLogger,
  resolveLoggerSettings,
} from '@ratingo/node-telemetry';

import { SERVICE_NAME } from './telemetry.constants';

export function createAppLogger(env: NodeJS.ProcessEnv = process.env): NestCompatibleLogger {
  return createNestLogger(resolveLoggerSettings(env, SERVICE_NAME));
}
