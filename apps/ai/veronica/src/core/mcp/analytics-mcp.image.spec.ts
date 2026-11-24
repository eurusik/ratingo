import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { GOOGLE_ANALYTICS_MCP_HOME, GOOGLE_ANALYTICS_MCP_VERSION } from '@ratingo/ai-core';

const APP_DIR = path.resolve(__dirname, '../../..');

describe('analytics-mcp in the Veronica image', () => {
  it('installs the version and path the platform definition pins', async () => {
    const dockerfile = await readFile(path.join(APP_DIR, 'Dockerfile'), 'utf8');
    const lock = await readFile(path.join(APP_DIR, 'analytics-mcp/requirements.lock'), 'utf8');
    const homes = [...dockerfile.matchAll(/^ARG ANALYTICS_MCP_HOME=(.+)$/gm)].map(
      (match) => match[1],
    );

    expect(homes.length).toBeGreaterThan(0);
    expect(new Set(homes)).toEqual(new Set([GOOGLE_ANALYTICS_MCP_HOME]));
    expect(lock).toContain(`analytics-mcp==${GOOGLE_ANALYTICS_MCP_VERSION} \\`);
    expect(dockerfile).toContain('--require-hashes');
  });

  it('hashes every locked package', async () => {
    const lock = await readFile(path.join(APP_DIR, 'analytics-mcp/requirements.lock'), 'utf8');
    const pins = lock.split('\n').filter((line) => /^[a-z0-9][a-z0-9._-]*==/i.test(line));

    expect(pins.length).toBeGreaterThan(0);
    expect(pins.every((line) => line.trimEnd().endsWith('\\'))).toBe(true);
  });
});
