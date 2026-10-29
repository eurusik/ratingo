import { type AppRole } from './app-role';

const WORKER_ROLE: AppRole = 'worker';

process.env.APP_ROLE ||= WORKER_ROLE;
