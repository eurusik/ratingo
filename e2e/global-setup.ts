/**
 * Global setup — runs seed-e2e.ts once before all tests.
 */
import { execSync } from 'child_process';
import * as path from 'path';

export default function globalSetup() {
  const seedScript = path.resolve(
    __dirname,
    '../apps/api/src/database/seed-e2e.ts',
  );

  console.log('[global-setup] Running E2E seed script...');
  execSync(`npx tsx ${seedScript}`, { stdio: 'inherit' });
  console.log('[global-setup] Seed complete.');
}
