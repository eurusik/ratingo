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
  settings?: readonly string[];
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
const MAX_RESULT_NOTE_CHARS = 300;
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

function envIssues(env: McpServerEnv, settings: readonly string[]): string[] {
  const keys = [
    ...Object.keys(env.constants ?? {}),
    ...env.required,
    ...(env.optional ?? []),
    ...settings,
  ];
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

const pinnedNames = (rule: McpToolRule): string[] => [
  ...Object.keys(rule.pinnedArguments ?? {}),
  ...Object.keys(rule.pinnedFromSettings ?? {}),
];

function settingIssues(label: string, rule: McpToolRule, settings: readonly string[]): string[] {
  const fromSettings = Object.entries(rule.pinnedFromSettings ?? {});
  return [
    ...fromSettings
      .filter(([, setting]) => !settings.includes(setting))
      .map(
        ([argument, setting]) =>
          `${label}: "${argument}" is pinned from undeclared setting "${setting}"`,
      ),
    ...fromSettings
      .filter(([argument]) => Object.hasOwn(rule.pinnedArguments ?? {}, argument))
      .map(([argument]) => `${label}: "${argument}" is pinned twice`),
  ];
}

function exposureIssues(label: string, rule: McpToolRule): string[] {
  const pinned = pinnedNames(rule);
  const constrained = Object.keys(rule.constraints ?? {});
  const exposed = rule.exposedArguments;
  const hiddenConstrained =
    exposed === undefined ? [] : constrained.filter((argument) => !exposed.includes(argument));
  return [
    ...constrained
      .filter((argument) => pinned.includes(argument))
      .map((argument) => `${label}: "${argument}" is both pinned and constrained`),
    ...(exposed ?? [])
      .filter((argument) => pinned.includes(argument))
      .map((argument) => `${label}: "${argument}" is both pinned and exposed`),
    ...hiddenConstrained.map(
      (argument) => `${label}: "${argument}" is constrained but not exposed`,
    ),
  ];
}

function ruleIssues(
  server: string,
  tool: string,
  rule: McpToolRule,
  settings: readonly string[],
): string[] {
  const label = `policy.tools.${tool}`;
  const constraints = Object.entries(rule.constraints ?? {});
  return [
    ...(canBridgeMcpTool({ server, tool }) ? [] : [`${label}: the tool name cannot be bridged`]),
    ...(rule.description.trim().length === 0 ? [`${label}: description must not be empty`] : []),
    ...(isPositive(rule.maxOutputChars) ? [] : [`${label}: maxOutputChars must be positive`]),
    ...resultNoteIssues(label, rule.resultNote),
    ...settingIssues(label, rule, settings),
    ...exposureIssues(label, rule),
    ...constraints.flatMap(([argument, constraint]) =>
      constraintIssues(`${label}.constraints.${argument}`, constraint),
    ),
  ];
}

function resultNoteIssues(label: string, note: string | undefined): string[] {
  if (note === undefined) {
    return [];
  }
  return note.trim().length > 0 && note.length <= MAX_RESULT_NOTE_CHARS
    ? []
    : [`${label}: resultNote must be 1 to ${MAX_RESULT_NOTE_CHARS} characters`];
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
    ...envIssues(definition.env, definition.settings ?? []),
    ...timeoutIssues(definition.timeouts),
    ...(isPositive(definition.maxOutputChars) ? [] : ['maxOutputChars must be positive']),
    ...(Object.keys(definition.policy.tools).length === 0
      ? ['policy must allow at least one tool']
      : []),
    ...Object.entries(definition.policy.tools).flatMap(([tool, rule]) =>
      ruleIssues(definition.name, tool, rule, definition.settings ?? []),
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
