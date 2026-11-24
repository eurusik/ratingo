import { validateMcpServerDefinition } from './mcp-server.definition';
import type { McpServerDefinition } from './mcp-server.definition';
import type { McpToolRule } from './mcp-tool-policy.types';

export type McpEnvValues = Readonly<Record<string, string | undefined>>;

export interface ConfiguredMcpServer {
  definition: McpServerDefinition;
  env: Readonly<Record<string, string>>;
}

export interface UnconfiguredMcpServer {
  definition: McpServerDefinition;
  missingKeys: readonly string[];
}

export interface ResolvedMcpServers {
  configured: readonly ConfiguredMcpServer[];
  unconfigured: readonly UnconfiguredMcpServer[];
}

export class DuplicateMcpServerError extends Error {
  constructor(name: string) {
    super(`MCP server "${name}" is registered more than once`);
    this.name = 'DuplicateMcpServerError';
  }
}

export class UnknownMcpServerError extends Error {
  constructor(name: string, known: readonly string[]) {
    super(
      `MCP server "${name}" is not on the platform allowlist (known: ${known.join(', ') || 'none'})`,
    );
    this.name = 'UnknownMcpServerError';
  }
}

const hasValue = (value: string | undefined): value is string =>
  value !== undefined && value.length > 0;

function explicitEnv(
  definition: McpServerDefinition,
  values: McpEnvValues,
): Record<string, string> {
  const fromConfig = [...definition.env.required, ...(definition.env.optional ?? [])].flatMap(
    (key) => {
      const value = values[key];
      return hasValue(value) ? [[key, value] as const] : [];
    },
  );
  return { ...definition.env.constants, ...Object.fromEntries(fromConfig) };
}

function pinnedFromSettings(rule: McpToolRule, values: McpEnvValues): McpToolRule {
  const resolved = Object.entries(rule.pinnedFromSettings ?? {}).map(
    ([argument, setting]) => [argument, values[setting] ?? ''] as const,
  );
  return {
    ...rule,
    pinnedArguments: { ...rule.pinnedArguments, ...Object.fromEntries(resolved) },
    pinnedFromSettings: undefined,
  };
}

function withSettingsPinned(
  definition: McpServerDefinition,
  values: McpEnvValues,
): McpServerDefinition {
  const tools = Object.fromEntries(
    Object.entries(definition.policy.tools).map(([tool, rule]) => [
      tool,
      pinnedFromSettings(rule, values),
    ]),
  );
  return { ...definition, policy: { tools } };
}

export class McpServerRegistry {
  private readonly definitions: ReadonlyMap<string, McpServerDefinition>;

  constructor(definitions: readonly McpServerDefinition[]) {
    const byName = new Map<string, McpServerDefinition>();
    for (const definition of definitions) {
      if (byName.has(definition.name)) {
        throw new DuplicateMcpServerError(definition.name);
      }
      byName.set(definition.name, validateMcpServerDefinition(definition));
    }
    this.definitions = byName;
  }

  names(): string[] {
    return [...this.definitions.keys()];
  }

  resolve(servers: readonly string[], values: McpEnvValues): ResolvedMcpServers {
    const configured: ConfiguredMcpServer[] = [];
    const unconfigured: UnconfiguredMcpServer[] = [];
    for (const name of new Set(servers)) {
      const definition = this.definitions.get(name);
      if (definition === undefined) {
        throw new UnknownMcpServerError(name, this.names());
      }
      const missingKeys = [...definition.env.required, ...(definition.settings ?? [])].filter(
        (key) => !hasValue(values[key]),
      );
      if (missingKeys.length > 0) {
        unconfigured.push({ definition, missingKeys });
      } else {
        configured.push({
          definition: withSettingsPinned(definition, values),
          env: explicitEnv(definition, values),
        });
      }
    }
    return { configured, unconfigured };
  }
}
