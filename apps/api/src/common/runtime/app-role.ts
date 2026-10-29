export const APP_ROLES = ['api', 'worker', 'all'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const DEFAULT_APP_ROLE: AppRole = 'all';

const isAppRole = (value: string): value is AppRole =>
  (APP_ROLES as readonly string[]).includes(value);

export function getAppRole(env: NodeJS.ProcessEnv = process.env): AppRole {
  const requested = env.APP_ROLE;
  if (!requested) {
    return DEFAULT_APP_ROLE;
  }
  if (!isAppRole(requested)) {
    throw new Error(`Invalid APP_ROLE "${env.APP_ROLE}". Expected one of: ${APP_ROLES.join(', ')}`);
  }
  return requested;
}

export const runsHttp = (role: AppRole = getAppRole()): boolean => role !== 'worker';

export const runsWorkers = (role: AppRole = getAppRole()): boolean => role !== 'api';

export const workerOnly = <T extends unknown[]>(...items: T): T | [] =>
  runsWorkers() ? items : [];

export const apiOnly = <T extends unknown[]>(...items: T): T | [] => (runsHttp() ? items : []);
