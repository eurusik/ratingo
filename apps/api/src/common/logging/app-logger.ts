import {
  createNestLogger,
  type NestCompatibleLogger,
  resolveLoggerSettings,
} from '@ratingo/node-telemetry';

import { SERVICE_NAME_BY_ROLE } from '@/telemetry/telemetry.constants';

import { getAppRole } from '../runtime/app-role';

import { parseJobIdPrefix } from './job-id-prefix';

export function createAppLogger(env: NodeJS.ProcessEnv = process.env): NestCompatibleLogger {
  const settings = resolveLoggerSettings(env, SERVICE_NAME_BY_ROLE[getAppRole(env)]);
  return createNestLogger(settings, parseJobIdPrefix);
}
