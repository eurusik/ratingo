export type McpJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly McpJsonValue[]
  | { readonly [key: string]: McpJsonValue };

export const McpConstraintKind = {
  NUMBER: 'number',
  ONE_OF: 'one_of',
  MAX_ITEMS: 'max_items',
  DATE_RANGES: 'date_ranges',
} as const;

export interface McpNumberConstraint {
  kind: typeof McpConstraintKind.NUMBER;
  min?: number;
  max: number;
  default?: number;
}

export interface McpOneOfConstraint {
  kind: typeof McpConstraintKind.ONE_OF;
  values: readonly string[];
}

export interface McpMaxItemsConstraint {
  kind: typeof McpConstraintKind.MAX_ITEMS;
  max: number;
}

export interface McpDateRangesConstraint {
  kind: typeof McpConstraintKind.DATE_RANGES;
  maxRanges: number;
  maxSpanDays: number;
  maxLookbackDays: number;
  startKey?: string;
  endKey?: string;
}

export type McpArgumentConstraint =
  McpNumberConstraint | McpOneOfConstraint | McpMaxItemsConstraint | McpDateRangesConstraint;

export interface McpToolRule {
  description: string;
  pinnedArguments?: Readonly<Record<string, McpJsonValue>>;
  constraints?: Readonly<Record<string, McpArgumentConstraint>>;
  maxOutputChars?: number;
}

export interface McpToolPolicy {
  tools: Readonly<Record<string, McpToolRule>>;
}

export const McpRefusalCode = {
  TOOL_NOT_ALLOWED: 'tool_not_allowed',
  INVALID_ARGUMENTS: 'invalid_arguments',
  OUT_OF_RANGE: 'out_of_range',
  VALUE_NOT_ALLOWED: 'value_not_allowed',
  TOO_MANY_ITEMS: 'too_many_items',
  DATE_RANGE_NOT_ALLOWED: 'date_range_not_allowed',
} as const;
export type McpRefusalCode = (typeof McpRefusalCode)[keyof typeof McpRefusalCode];

export interface McpRefusal {
  code: McpRefusalCode;
  argument?: string;
  message: string;
}

export type McpCallDecision =
  { allowed: true; arguments: Record<string, unknown> } | { allowed: false; refusal: McpRefusal };
