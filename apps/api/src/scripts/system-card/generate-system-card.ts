import { writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { SYSTEM_CARD_PATH, renderSystemCardFile } from './system-card.builder';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../..');

const target = path.join(REPOSITORY_ROOT, SYSTEM_CARD_PATH);
writeFileSync(target, renderSystemCardFile());
process.stdout.write(`System card written to ${SYSTEM_CARD_PATH}\n`);
