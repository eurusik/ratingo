import type { JsonSchema } from '../model/model.types';
import { sanitizeJsonSchema } from '../schema/json-schema-sanitizer';
import { checkArgumentConstraint } from './mcp-argument-constraints';
import { McpConstraintKind, McpRefusalCode } from './mcp-tool-policy.types';
import type {
  McpArgumentConstraint,
  McpCallContext,
  McpCallDecision,
  McpRefusal,
  McpToolPolicy,
  McpToolRule,
} from './mcp-tool-policy.types';

export const MAX_SCHEMA_DESCRIPTION_CHARS = 500;
const DROPPED_SCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  '$schema',
  '$id',
  '$comment',
  'title',
  'examples',
]);
const DESCRIPTION_KEYWORD = 'description';
const DEFAULT_KEYWORD = 'default';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function ruleFor(policy: McpToolPolicy, tool: string): McpToolRule | undefined {
  return Object.hasOwn(policy.tools, tool) ? policy.tools[tool] : undefined;
}

function withoutPinned(input: Json, rule: McpToolRule): Json {
  const pinned = rule.pinnedArguments ?? {};
  return Object.fromEntries(Object.entries(input).filter(([key]) => !Object.hasOwn(pinned, key)));
}

function withDefaults(input: Json, rule: McpToolRule, known: readonly string[]): Json {
  const defaults = Object.entries(rule.constraints ?? {}).flatMap(([key, constraint]) =>
    constraint.kind === McpConstraintKind.NUMBER && input[key] === undefined && known.includes(key)
      ? [[key, constraint.default] as const]
      : [],
  );
  return { ...input, ...Object.fromEntries(defaults) };
}

export function argumentNamesOf(schema: JsonSchema): string[] {
  return isRecord(schema.properties) ? Object.keys(schema.properties) : [];
}

export function undeclaredPolicyArguments(rule: McpToolRule, schema: JsonSchema): string[] {
  const known = argumentNamesOf(schema);
  const named = [
    ...Object.keys(rule.pinnedArguments ?? {}),
    ...Object.keys(rule.constraints ?? {}),
  ];
  return named.filter((key) => !known.includes(key));
}

function firstUnknownArgument(input: Json, known: readonly string[]): string | undefined {
  return Object.keys(input).find((key) => !known.includes(key));
}

function refused(refusal: McpRefusal): McpCallDecision {
  return { allowed: false, refusal };
}

function firstConstraintRefusal(
  prepared: Json,
  rule: McpToolRule,
  todayEpochDay: number,
): McpRefusal | undefined {
  for (const [argument, constraint] of Object.entries(rule.constraints ?? {})) {
    const value = prepared[argument];
    const refusal =
      value === undefined
        ? undefined
        : checkArgumentConstraint(argument, value, constraint, todayEpochDay);
    if (refusal !== undefined) {
      return refusal;
    }
  }
  return undefined;
}

export function decideMcpCall(
  policy: McpToolPolicy,
  tool: string,
  input: unknown,
  context: McpCallContext,
): McpCallDecision {
  const rule = ruleFor(policy, tool);
  if (rule === undefined) {
    return refused({
      code: McpRefusalCode.TOOL_NOT_ALLOWED,
      message: `Tool "${tool}" is not allowed`,
    });
  }
  if (!isRecord(input)) {
    return refused({
      code: McpRefusalCode.INVALID_ARGUMENTS,
      message: 'Arguments must be an object',
    });
  }
  const fromModel = withoutPinned(input, rule);
  const unknown = firstUnknownArgument(fromModel, context.knownArguments);
  if (unknown !== undefined) {
    return refused({
      code: McpRefusalCode.UNKNOWN_ARGUMENT,
      argument: unknown,
      message: `"${unknown}" is not an argument of this tool`,
    });
  }
  const prepared = withDefaults(fromModel, rule, context.knownArguments);
  const refusal = firstConstraintRefusal(prepared, rule, context.todayEpochDay);
  return refusal === undefined
    ? { allowed: true, arguments: { ...prepared, ...rule.pinnedArguments } }
    : refused(refusal);
}

function narrowProperty(property: unknown, constraint: McpArgumentConstraint): unknown {
  const base = isRecord(property) ? property : {};
  switch (constraint.kind) {
    case McpConstraintKind.ONE_OF:
      return isRecord(base.items)
        ? { ...base, items: { ...base.items, enum: [...constraint.values] } }
        : { ...base, enum: [...constraint.values] };
    case McpConstraintKind.NUMBER:
      return {
        ...base,
        maximum: constraint.max,
        ...(constraint.min === undefined ? {} : { minimum: constraint.min }),
      };
    case McpConstraintKind.MAX_ITEMS:
      return { ...base, maxItems: constraint.max };
    case McpConstraintKind.DATE_RANGES:
      return { ...base, maxItems: constraint.maxRanges };
  }
}

function shapeForModel(remote: JsonSchema, rule: McpToolRule): JsonSchema {
  const pinned = rule.pinnedArguments ?? {};
  const isPinned = (key: string) => Object.hasOwn(pinned, key);
  const properties = isRecord(remote.properties) ? remote.properties : {};
  const visible = Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => !isPinned(key))
      .map(([key, property]) => {
        const constraint = rule.constraints?.[key];
        return [key, constraint === undefined ? property : narrowProperty(property, constraint)];
      }),
  );
  const required = Array.isArray(remote.required)
    ? remote.required.filter((key): key is string => typeof key === 'string' && !isPinned(key))
    : [];
  return { ...remote, type: 'object', properties: visible, required, additionalProperties: false };
}

const capDescription = (keyword: string, value: unknown): unknown =>
  keyword === DESCRIPTION_KEYWORD && typeof value === 'string'
    ? value.slice(0, MAX_SCHEMA_DESCRIPTION_CHARS)
    : value;

const isDroppedKeyword = (keyword: string, value: unknown): boolean =>
  DROPPED_SCHEMA_KEYWORDS.has(keyword) || (keyword === DEFAULT_KEYWORD && value === null);

export function exposedInputSchema(remote: JsonSchema, rule: McpToolRule): JsonSchema {
  return sanitizeJsonSchema(shapeForModel(remote, rule), {
    drop: isDroppedKeyword,
    mapValue: capDescription,
  });
}
