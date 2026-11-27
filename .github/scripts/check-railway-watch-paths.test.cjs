const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  agentDirectories,
  copiedWorkspaceRoots,
  missingWatchPatterns,
} = require('./check-railway-watch-paths.cjs');

const roots = (dockerfile) => [...copiedWorkspaceRoots(dockerfile)].sort();

test('finds the workspaces a Dockerfile copies, in any letter case and with flags', () => {
  const dockerfile = [
    'COPY package.json package-lock.json ./',
    'copy apps/ai/veronica/package.json apps/ai/veronica/package.json',
    'COPY --chown=node:node packages/ai-core/package.json packages/ai-core/package.json',
    'COPY --from=build /app/packages/ai-ops-tools/dist ./packages/ai-ops-tools/dist',
    'ADD packages/node-telemetry/src ./packages/node-telemetry/src',
    'COPY . .',
  ].join('\n');

  assert.deepEqual(roots(dockerfile), [
    'apps/ai/veronica',
    'packages/ai-core',
    'packages/ai-ops-tools',
    'packages/node-telemetry',
  ]);
});

test('ignores what a COPY takes from a stage that is not the repository build', () => {
  const dockerfile =
    'COPY --from=analytics-mcp $ANALYTICS_MCP_HOME $ANALYTICS_MCP_HOME\nCOPY --from=node:22 /usr/local/bin/node /usr/local/bin/node';

  assert.deepEqual(roots(dockerfile), []);
});

test('reads every source of a COPY with several sources and the JSON form', () => {
  const dockerfile = [
    'COPY packages/ai-core/package.json packages/ai-ops-tools/package.json ./packages/',
    'COPY ["packages/node-telemetry/package.json", "packages/web-core/package.json", "./"]',
  ].join('\n');

  assert.deepEqual(roots(dockerfile), [
    'packages/ai-core',
    'packages/ai-ops-tools',
    'packages/node-telemetry',
    'packages/web-core',
  ]);
});

test('joins a COPY continued over several lines', () => {
  const dockerfile =
    'COPY packages/ai-core/package.json \\\n  packages/ai-ops-tools/package.json \\\n  ./packages/';

  assert.deepEqual(roots(dockerfile), ['packages/ai-core', 'packages/ai-ops-tools']);
});

test('fails on a COPY it cannot read instead of passing', () => {
  assert.throws(() => copiedWorkspaceRoots('COPY packages/ai-core/package.json'), /cannot parse/);
  assert.throws(() => copiedWorkspaceRoots('COPY $SOURCE ./'), /cannot parse/);
  assert.throws(() => copiedWorkspaceRoots('COPY packages/*/package.json ./'), /cannot parse/);
  assert.throws(() => copiedWorkspaceRoots('COPY ["packages/ai-core"'), /cannot parse/);
});

test('names every copied workspace and the lock file that the patterns lack', () => {
  const dockerfile =
    'COPY packages/ai-core/package.json x\nCOPY packages/ai-ops-tools/package.json y';

  assert.deepEqual(missingWatchPatterns(dockerfile, ['/packages/ai-core/**']), [
    '/packages/ai-ops-tools/**',
    '/package-lock.json',
  ]);
  assert.deepEqual(
    missingWatchPatterns(dockerfile, [
      '/packages/ai-core/**',
      '/packages/ai-ops-tools/**',
      '/package-lock.json',
    ]),
    [],
  );
});

test('discovers the agents that have a railway.json', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'watch-paths-'));
  for (const name of ['one', 'two'])
    mkdirSync(path.join(root, 'apps/ai', name), { recursive: true });
  writeFileSync(path.join(root, 'apps/ai/one/railway.json'), '{}');

  assert.deepEqual(agentDirectories(root), ['apps/ai/one']);
});
