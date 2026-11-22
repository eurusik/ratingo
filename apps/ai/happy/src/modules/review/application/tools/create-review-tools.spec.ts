import type { Tool } from '@ratingo/ai-core';

import { parseRule } from '../../domain/policies/rule-selector';
import {
  buildChangedFile,
  buildFakeCodeHost,
  buildPullRequest,
} from '../../infrastructure/testing/fake-code-host.testing';

import { createReviewTools } from './create-review-tools';

const CONTEXT = { runId: 'r1' };

const build = () => {
  const host = buildFakeCodeHost({
    contents: {
      'head222:src/a.ts': Array.from({ length: 400 }, (_, i) => `line ${i + 1}`).join('\n'),
      'base111:src/a.ts': 'old line',
      'head222:.env': 'SECRET=1',
    },
  });
  const tools = createReviewTools({
    host,
    pr: buildPullRequest(),
    files: [buildChangedFile({ path: 'src/a.ts' })],
    rules: [parseRule({ path: 'CLAUDE.md', content: 'Never use Date in the domain layer' })],
  });
  const byName = (name: string): Tool => tools.find((tool) => tool.name === name) as Tool;
  return { host, tools, byName };
};

describe('review tools', () => {
  it('exposes only read-only tools', () => {
    const { tools } = build();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_rules',
      'list_changed_files',
      'read_file',
    ]);
    expect(tools.every((tool) => tool.readOnly)).toBe(true);
  });

  it('reads numbered lines and caps a single read', async () => {
    const out = await build().byName('read_file').run({ path: 'src/a.ts', startLine: 3 }, CONTEXT);
    const lines = out.split('\n');
    expect(lines[0]).toBe('3: line 3');
    expect(lines).toHaveLength(300);
  });

  it('reads the base version on request and reports a missing file', async () => {
    const { byName } = build();
    expect(await byName('read_file').run({ path: 'src/a.ts', ref: 'base' }, CONTEXT)).toBe(
      '1: old line',
    );
    expect(await byName('read_file').run({ path: 'nope.ts' }, CONTEXT)).toContain('does not exist');
  });

  it.each(['../secret', '/etc/passwd', '.env', 'apps/api/.env.production', 'keys/server.pem'])(
    'refuses to read %s',
    async (path) => {
      const { byName, host } = build();
      expect(await byName('read_file').run({ path }, CONTEXT)).toBe('This path cannot be read.');
      expect(host.reads).toHaveLength(0);
    },
  );

  it('rejects an arbitrary git ref', async () => {
    await expect(
      build().byName('read_file').run({ path: 'src/a.ts', ref: 'main~5' }, CONTEXT),
    ).rejects.toThrow(/Invalid input/);
  });

  it('lists changed files and finds rules by topic', async () => {
    const { byName } = build();
    expect(await byName('list_changed_files').run({}, CONTEXT)).toContain(
      'modified src/a.ts +30 -2',
    );
    expect(await byName('get_rules').run({ topic: 'domain layer' }, CONTEXT)).toContain(
      'CLAUDE.md',
    );
    expect(await byName('get_rules').run({ topic: 'kubernetes' }, CONTEXT)).toContain('No rule');
  });
});
