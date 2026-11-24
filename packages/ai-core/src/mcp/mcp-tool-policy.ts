import type { JsonSchema } from '../model/model.types';
import { sanitizeJsonSchema } from '../schema/json-schema-sanitizer';
import { checkArgumentConstraint } from './mcp-argument-constraints';
import { McpConstraintKind, McpRefusalCode } from './mcp-tool-policy.types';
import type {
  McpArgumentConstraint,
  McpCallDecision,
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

function withDefaults(input: Json, rule: McpToolRule): Json {
  const defaults = Object.entries(rule.constraints ?? {}).flatMap(([key, constraint]) =>
    constraint.kind === McpConstraintKind.NUMBER &&
    constraint.default !== undefined &&
    input[key] === undefined
      ? [[key, constraint.default] as const]
      : [],
  );
  return { ...input, ...Object.fromEntries(defaults) };
}

export function decideMcpCall(
  policy: McpToolPolicy,
  tool: string,
  input: unknown,
  todayEpochDay: number,
): McpCallDecision {
  const rule = ruleFor(policy, tool);
  if (rule === undefined) {
    return {
      allowed: false,
      refusal: { code: McpRefusalCode.TOOL_NOT_ALLOWED, message: `Tool "${tool}" is not allowed` },
    };
  }
  if (!isRecord(input)) {
    return {
      allowed: false,
      refusal: { code: McpRefusalCode.INVALID_ARGUMENTS, message: 'Arguments must be an object' },
    };
  }
  const prepared = withDefaults(withoutPinned(input, rule), rule);
  for (const [argument, constraint] of Object.entries(rule.constraints ?? {})) {
    if (prepared[argument] === undefined) {
      continue;
    }
    const refusal = checkArgumentConstraint(
      argument,
      prepared[argument],
      constraint,
      todayEpochDay,
    );
    if (refusal !== undefined) {
      return { allowed: false, refusal };
    }
  }
  return { allowed: true, arguments: { ...prepared, ...rule.pinnedArguments } };
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
  return { ...remote, type: 'object', properties: visible, required };
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
