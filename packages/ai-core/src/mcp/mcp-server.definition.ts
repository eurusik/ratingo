import { DEFAULT_TOOL_OUTPUT_CAP_CHARS } from '../tools/define-tool';
import { McpConstraintKind } from './mcp-tool-policy.types';
import type { McpArgumentConstraint, McpToolPolicy, McpToolRule } from './mcp-tool-policy.types';
import { canBridgeMcpTool, isValidMcpServerName, MCP_SERVER_NAME_PATTERN } from './mcp-tool-name';

export const McpTransportKind = {
  STDIO: 'stdio',
} as const;
export type McpTransportKind = (typeof McpTransportKind)[keyof typeof McpTransportKind];

export interface McpStdioLaunch {
  kind: typeof McpTransportKind.STDIO;
  command: string;
  args: readonly string[];
}

export interface McpServerEnv {
  constants?: Readonly<Record<string, string>>;
  required: readonly string[];
  optional?: readonly string[];
}

export interface McpServerTimeouts {
  startMs: number;
  callMs: number;
  idleTtlMs: number;
  restartCooldownMs: number;
}

export interface McpServerDefinition {
  name: string;
  pinnedVersion: string;
  launch: McpStdioLaunch;
  env: McpServerEnv;
  timeouts: McpServerTimeouts;
  maxOutputChars?: number;
  policy: McpToolPolicy;
}

export class InvalidMcpServerDefinitionError extends Error {
  constructor(
    readonly server: string,
    readonly issues: readonly string[],
  ) {
    super(
      `Invalid MCP server definition "${server}":\n${issues.map((issue) => `- ${issue}`).join('\n')}`,
    );
    this.name = 'InvalidMcpServerDefinitionError';
  }
}

const VERSION_RANGE_CHARACTERS = /[\s*^~<>|]|^latest$|\.x$/i;
const ABSOLUTE_PATH = /^\//;
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

const isPositive = (value: number | undefined): boolean =>
  value === undefined || (Number.isFinite(value) && value > 0);

function versionIssues(definition: McpServerDefinition): string[] {
  const { pinnedVersion, launch } = definition;
  if (pinnedVersion.length === 0 || VERSION_RANGE_CHARACTERS.test(pinnedVersion)) {
    return [`pinnedVersion "${pinnedVersion}" must be one exact version, not a range or tag`];
  }
  const mentioned = [launch.command, ...launch.args].some((part) => part.includes(pinnedVersion));
  return mentioned
    ? []
    : [`launch must name pinnedVersion "${pinnedVersion}" in its command or args`];
}

function envIssues(env: McpServerEnv): string[] {
  const keys = [...Object.keys(env.constants ?? {}), ...env.required, ...(env.optional ?? [])];
  const invalid = keys
    .filter((key) => !ENV_KEY_PATTERN.test(key))
    .map((key) => `env key "${key}" is not UPPER_SNAKE_CASE`);
  const duplicated = keys
    .filter((key, index) => keys.indexOf(key) !== index)
    .map((key) => `env key "${key}" is declared twice`);
  return [...invalid, ...duplicated];
}

function constraintIssues(label: string, constraint: McpArgumentConstraint): string[] {
  switch (constraint.kind) {
    case McpConstraintKind.NUMBER: {
      const min = constraint.min ?? Number.NEGATIVE_INFINITY;
      const fallback = constraint.default;
      const badDefault = !Number.isFinite(fallback) || fallback < min || fallback > constraint.max;
      return [
        ...(min > constraint.max ? [`${label}: min is greater than max`] : []),
        ...(badDefault ? [`${label}: default must be set and within min..max`] : []),
      ];
    }
    case McpConstraintKind.ONE_OF:
      return constraint.values.length === 0 ? [`${label}: values must not be empty`] : [];
    case McpConstraintKind.MAX_ITEMS:
      return isPositive(constraint.max) ? [] : [`${label}: max must be positive`];
    case McpConstraintKind.DATE_RANGES:
      return [constraint.maxRanges, constraint.maxSpanDays, constraint.maxLookbackDays].every(
        (value) => isPositive(value),
      )
        ? []
        : [`${label}: maxRanges, maxSpanDays and maxLookbackDays must be positive`];
  }
}

function ruleIssues(server: string, tool: string, rule: McpToolRule): string[] {
  const label = `policy.tools.${tool}`;
  const pinned = Object.keys(rule.pinnedArguments ?? {});
  const constraints = Object.entries(rule.constraints ?? {});
  return [
    ...(canBridgeMcpTool({ server, tool }) ? [] : [`${label}: the tool name cannot be bridged`]),
    ...(rule.description.trim().length === 0 ? [`${label}: description must not be empty`] : []),
    ...(isPositive(rule.maxOutputChars) ? [] : [`${label}: maxOutputChars must be positive`]),
    ...constraints
      .filter(([argument]) => pinned.includes(argument))
      .map(([argument]) => `${label}: "${argument}" is both pinned and constrained`),
    ...constraints.flatMap(([argument, constraint]) =>
      constraintIssues(`${label}.constraints.${argument}`, constraint),
    ),
  ];
}

function timeoutIssues(timeouts: McpServerTimeouts): string[] {
  return Object.entries(timeouts)
    .filter(([, value]) => !isPositive(value as number))
    .map(([key]) => `timeouts.${key} must be positive`);
}

export function validateMcpServerDefinition(definition: McpServerDefinition): McpServerDefinition {
  const issues = [
    ...(isValidMcpServerName(definition.name)
      ? []
      : [`name must match ${MCP_SERVER_NAME_PATTERN.source}`]),
    ...versionIssues(definition),
    ...(ABSOLUTE_PATH.test(definition.launch.command)
      ? []
      : ['launch.command must be an absolute path: the server gets no PATH']),
    ...envIssues(definition.env),
    ...timeoutIssues(definition.timeouts),
    ...(isPositive(definition.maxOutputChars) ? [] : ['maxOutputChars must be positive']),
    ...(Object.keys(definition.policy.tools).length === 0
      ? ['policy must allow at least one tool']
      : []),
    ...Object.entries(definition.policy.tools).flatMap(([tool, rule]) =>
      ruleIssues(definition.name, tool, rule),
    ),
  ];
  if (issues.length > 0) {
    throw new InvalidMcpServerDefinitionError(definition.name, issues);
  }
  return definition;
}

export function outputCapFor(definition: McpServerDefinition, rule: McpToolRule): number {
  return rule.maxOutputChars ?? definition.maxOutputChars ?? DEFAULT_TOOL_OUTPUT_CAP_CHARS;
}
