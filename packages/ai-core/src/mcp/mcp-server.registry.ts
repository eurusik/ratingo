import { validateMcpServerDefinition } from './mcp-server.definition';
import type { McpServerDefinition } from './mcp-server.definition';

export type McpEnvValues = Readonly<Record<string, string | undefined>>;

export interface ConfiguredMcpServer {
  definition: McpServerDefinition;
  env: Readonly<Record<string, string>>;
}

export interface UnconfiguredMcpServer {
  definition: McpServerDefinition;
  missingEnv: readonly string[];
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
      const missingEnv = definition.env.required.filter((key) => !hasValue(values[key]));
      if (missingEnv.length > 0) {
        unconfigured.push({ definition, missingEnv });
      } else {
        configured.push({ definition, env: explicitEnv(definition, values) });
      }
    }
    return { configured, unconfigured };
  }
}
