const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const appRoot = process.argv[2] ?? '/app';
const requireFromApi = createRequire(path.join(appRoot, 'apps/api/package.json'));
const installedLockfile = JSON.parse(readFileSync(path.join(appRoot, 'node_modules/.package-lock.json'), 'utf8'));

const packagesWithInstallScripts = Object.entries(installedLockfile.packages)
  .filter(([, entry]) => entry.hasInstallScript)
  .map(([location]) => path.join(appRoot, location));

let failures = 0;
for (const packageDir of packagesWithInstallScripts) {
  try {
    require(packageDir);
    console.log(`loaded ${path.relative(appRoot, packageDir)}`);
  } catch (error) {
    failures += 1;
    console.error(`::error::cannot load ${path.relative(appRoot, packageDir)}: ${error.message}`);
  }
}

const bcrypt = requireFromApi('bcrypt');
if (!bcrypt.compareSync('ratingo', bcrypt.hashSync('ratingo', 4))) {
  failures += 1;
  console.error('::error::bcrypt hash/compare round-trip failed');
}

process.exit(failures > 0 ? 1 : 0);
