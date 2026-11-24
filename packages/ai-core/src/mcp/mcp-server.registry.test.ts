import { InvalidMcpServerDefinitionError } from './mcp-server.definition';
import type { McpServerDefinition } from './mcp-server.definition';
import {
  DuplicateMcpServerError,
  McpServerRegistry,
  UnknownMcpServerError,
} from './mcp-server.registry';
import { McpConstraintKind } from './mcp-tool-policy.types';
import { fakeServerDefinition } from './testing/fake-mcp-server.definition';

const withChanges = (changes: Partial<McpServerDefinition>): McpServerDefinition => ({
  ...fakeServerDefinition(),
  ...changes,
});

const issuesOf = (definition: McpServerDefinition): readonly string[] => {
  try {
    new McpServerRegistry([definition]);
    return [];
  } catch (error) {
    return (error as InvalidMcpServerDefinitionError).issues;
  }
};

describe('McpServerRegistry', () => {
  it('resolves an explicit env from constants and declared keys only', () => {
    const registry = new McpServerRegistry([fakeServerDefinition()]);

    const resolved = registry.resolve(['fake'], {
      FAKE_TOKEN: 'secret',
      PATH: '/usr/bin',
      DATABASE_URL: 'postgres://x',
    });

    expect(resolved.unconfigured).toEqual([]);
    expect(resolved.configured[0]?.env).toEqual({ FAKE_MODE: 'test', FAKE_TOKEN: 'secret' });
  });

  it('marks a server with missing required env as unconfigured', () => {
    const registry = new McpServerRegistry([fakeServerDefinition()]);

    expect(registry.resolve(['fake'], { FAKE_TOKEN: '' })).toEqual({
      configured: [],
      unconfigured: [{ name: 'fake', missingEnv: ['FAKE_TOKEN'] }],
    });
  });

  it('fails clearly on a server that is not on the allowlist', () => {
    const registry = new McpServerRegistry([fakeServerDefinition()]);

    expect(() => registry.resolve(['github'], {})).toThrow(UnknownMcpServerError);
    expect(() => registry.resolve(['github'], {})).toThrow('known: fake');
  });

  it('rejects a server registered twice', () => {
    expect(() => new McpServerRegistry([fakeServerDefinition(), fakeServerDefinition()])).toThrow(
      DuplicateMcpServerError,
    );
  });

  it('accepts the fixture definition', () => {
    expect(issuesOf(fakeServerDefinition())).toEqual([]);
  });

  it.each([
    ['a range instead of a pinned version', { pinnedVersion: '^1.0.0' }, 'exact version'],
    ['a tag instead of a pinned version', { pinnedVersion: 'latest' }, 'exact version'],
    ['a server name with an underscore', { name: 'my_ga' }, 'name must match'],
  ])('rejects %s', (_label, changes, message) => {
    expect(issuesOf(withChanges(changes)).join('\n')).toContain(message);
  });

  it('rejects a relative launch command, since the server gets no PATH', () => {
    const definition = withChanges({
      launch: { ...fakeServerDefinition().launch, command: 'node' },
    });
    expect(issuesOf(definition).join('\n')).toContain('must be an absolute path');
  });

  it('rejects a launch that does not name the pinned version', () => {
    const definition = withChanges({
      launch: { ...fakeServerDefinition().launch, args: ['server.cjs'] },
    });
    expect(issuesOf(definition).join('\n')).toContain('must name pinnedVersion');
  });

  it('rejects an argument that is both pinned and constrained', () => {
    const definition = withChanges({
      policy: {
        tools: {
          report: {
            description: 'Report',
            pinnedArguments: { limit: 5 },
            constraints: { limit: { kind: McpConstraintKind.NUMBER, max: 10 } },
          },
        },
      },
    });
    expect(issuesOf(definition)).toContain(
      'policy.tools.report: "limit" is both pinned and constrained',
    );
  });

  it('rejects a default outside the numeric range and a lowercase env key', () => {
    const definition = withChanges({
      env: { required: ['token'] },
      policy: {
        tools: {
          report: {
            description: 'Report',
            constraints: { limit: { kind: McpConstraintKind.NUMBER, max: 10, default: 20 } },
          },
        },
      },
    });
    expect(issuesOf(definition)).toEqual(
      expect.arrayContaining([
        'env key "token" is not UPPER_SNAKE_CASE',
        'policy.tools.report.constraints.limit: default is outside min..max',
      ]),
    );
  });

  it('rejects an empty policy', () => {
    expect(issuesOf(withChanges({ policy: { tools: {} } }))).toContain(
      'policy must allow at least one tool',
    );
  });
});
