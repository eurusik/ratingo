import { config } from 'dotenv';

import { ENV_FILE_PATHS } from './env-files';

config({ path: ENV_FILE_PATHS, quiet: true });
