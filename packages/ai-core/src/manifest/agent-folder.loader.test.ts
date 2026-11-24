import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentFolderError, loadAgentFolder } from './agent-folder.loader';

const VALID_MANIFEST = `
name: veronica
models: { default: fast }
tools: [prom_query]
skills: [ratingo-queues]
mcp: []
budgets: { perRunUsd: 0.05, perDayUsd: 0.5 }
`;

const VALID_TASK = `---
schedule: '0 9 * * *'
timezone: Europe/Kyiv
model: fast
budgetUsd: 0.02
---

Write the headline for today's digest.
`;

describe('loadAgentFolder', () => {
  let folder: string;

  const write = async (relativePath: string, content: string): Promise<void> => {
    const target = path.join(folder, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };

  const writeValidFolder = async (): Promise<void> => {
    await write('agent.yaml', VALID_MANIFEST);
    await write('tasks/daily-digest.md', VALID_TASK);
    await write('prompts/system.md', '  You are Veronica.  \n');
    await write('skills/ratingo-queues/SKILL.md', '# Queues');
  };

  const issuesOf = async (): Promise<readonly string[]> => {
    const failure = await loadAgentFolder(folder, { knownModelAliases: ['fast'] }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AgentFolderError);
    return (failure as AgentFolderError).issues;
  };

  beforeEach(async () => {
    folder = await mkdtemp(path.join(os.tmpdir(), 'ai-core-agent-'));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('loads a valid agent folder', async () => {
    await writeValidFolder();

    const loaded = await loadAgentFolder(folder, { knownModelAliases: ['fast'] });

    expect(loaded.manifest.name).toBe('veronica');
    expect(loaded.tasks).toEqual([
      {
        name: 'daily-digest',
        frontmatter: {
          schedule: '0 9 * * *',
          timezone: 'Europe/Kyiv',
          model: 'fast',
          budgetUsd: 0.02,
        },
        body: "Write the headline for today's digest.",
      },
    ]);
    expect(loaded.prompts).toEqual({ system: 'You are Veronica.' });
  });

  it('works for an agent without tasks, prompts or skills', async () => {
    await write(
      'agent.yaml',
      'name: happy\nmodels: { default: review }\nbudgets: { perRunUsd: 1, perDayUsd: 5 }\n',
    );

    const loaded = await loadAgentFolder(folder);

    expect(loaded.tasks).toEqual([]);
    expect(loaded.prompts).toEqual({});
  });

  it('fails when agent.yaml is missing', async () => {
    expect(await issuesOf()).toEqual(['agent.yaml: file is missing']);
  });

  it('fails on invalid YAML', async () => {
    await write('agent.yaml', 'name: [unclosed');

    expect((await issuesOf())[0]).toContain('invalid YAML');
  });

  it('reports every problem at once with its location', async () => {
    await write('agent.yaml', VALID_MANIFEST.replace('perRunUsd: 0.05', 'perRunUsd: -1'));
    await write('tasks/daily-digest.md', '---\nschedule: "0 9 * * *"\n---\nbody');
    await write('tasks/broken.md', '---\nbudgetUsd: nope\n---\nbody');

    const issues = await issuesOf();

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('agent.yaml.budgets.perRunUsd'),
        expect.stringContaining('tasks/daily-digest.md.timezone'),
        expect.stringContaining('tasks/broken.md.budgetUsd'),
      ]),
    );
  });

  it('fails when a listed skill has no SKILL.md', async () => {
    await writeValidFolder();
    await rm(path.join(folder, 'skills'), { recursive: true });

    expect(await issuesOf()).toEqual([
      'agent.yaml: skill "ratingo-queues" has no skills/ratingo-queues/SKILL.md',
    ]);
  });

  it('fails on a model alias the config does not define', async () => {
    await writeValidFolder();
    await write('tasks/daily-digest.md', VALID_TASK.replace('model: fast', 'model: smart'));

    expect(await issuesOf()).toEqual(['tasks/daily-digest.md: model uses unknown alias "smart"']);
  });

  it('fails on a malformed provider:model reference', async () => {
    await writeValidFolder();
    await write('tasks/daily-digest.md', VALID_TASK.replace('model: fast', 'model: "anthropic:"'));

    expect(await issuesOf()).toEqual([
      'tasks/daily-digest.md: model uses unknown alias "anthropic:"',
    ]);
  });

  it('fails when task frontmatter is never closed', async () => {
    await writeValidFolder();
    await write('tasks/daily-digest.md', '---\nschedule: "0 9 * * *"\nbody without closing');

    expect(await issuesOf()).toEqual(['tasks/daily-digest.md: frontmatter is not closed with ---']);
  });

  it('fails when a task has invalid YAML', async () => {
    await writeValidFolder();
    await write('tasks/daily-digest.md', '---\nschedule: [unclosed\n---\nbody');

    expect((await issuesOf())[0]).toContain('invalid YAML');
  });

  it('fails on an MCP server that is not on the platform allowlist', async () => {
    await writeValidFolder();
    await write('agent.yaml', VALID_MANIFEST.replace('mcp: []', 'mcp: [ga, github]'));

    const failure = await loadAgentFolder(folder, {
      knownModelAliases: ['fast'],
      knownMcpServers: ['ga'],
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AgentFolderError);
    expect((failure as AgentFolderError).issues).toEqual([
      'agent.yaml: mcp server "github" is not on the platform allowlist (known: ga)',
    ]);
  });

  it('accepts MCP servers the platform registers', async () => {
    await writeValidFolder();
    await write('agent.yaml', VALID_MANIFEST.replace('mcp: []', 'mcp: [ga]'));

    const loaded = await loadAgentFolder(folder, {
      knownModelAliases: ['fast'],
      knownMcpServers: ['ga'],
    });

    expect(loaded.manifest.mcp).toEqual(['ga']);
  });

  it('accepts a direct provider:model reference without alias config', async () => {
    await write(
      'agent.yaml',
      'name: happy\nmodels: { default: "anthropic:claude-sonnet-5-5" }\nbudgets: { perRunUsd: 1, perDayUsd: 5 }\n',
    );

    await expect(loadAgentFolder(folder, { knownModelAliases: [] })).resolves.toBeDefined();
  });
});
