import { daysAgoOf } from './mcp-calendar';
import { McpConstraintKind, McpRefusalCode } from './mcp-tool-policy.types';
import type {
  McpArgumentConstraint,
  McpDateRangesConstraint,
  McpMaxItemsConstraint,
  McpNumberConstraint,
  McpOneOfConstraint,
  McpRefusal,
} from './mcp-tool-policy.types';

const DEFAULT_DATE_RANGE_START_KEY = 'start_date';
const DEFAULT_DATE_RANGE_END_KEY = 'end_date';
const PROPERTY_TIMEZONE_LEAD_DAYS = 1;

type ConstraintCheck = McpRefusal | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function refuse(code: McpRefusal['code'], argument: string, message: string): McpRefusal {
  return { code, argument, message };
}

function checkNumber(
  argument: string,
  value: unknown,
  constraint: McpNumberConstraint,
): ConstraintCheck {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return refuse(McpRefusalCode.INVALID_ARGUMENTS, argument, `"${argument}" must be a number`);
  }
  const min = constraint.min ?? Number.NEGATIVE_INFINITY;
  if (value < min || value > constraint.max) {
    const lower = constraint.min === undefined ? '' : `at least ${constraint.min} and `;
    return refuse(
      McpRefusalCode.OUT_OF_RANGE,
      argument,
      `"${argument}" must be ${lower}at most ${constraint.max}`,
    );
  }
  return undefined;
}

function checkOneOf(
  argument: string,
  value: unknown,
  constraint: McpOneOfConstraint,
): ConstraintCheck {
  const values = Array.isArray(value) ? (value as unknown[]) : [value];
  const isAllowed = (item: unknown) => typeof item === 'string' && constraint.values.includes(item);
  if (values.every(isAllowed)) {
    return undefined;
  }
  return refuse(
    McpRefusalCode.VALUE_NOT_ALLOWED,
    argument,
    `"${argument}" accepts only: ${constraint.values.join(', ')}`,
  );
}

function checkMaxItems(
  argument: string,
  value: unknown,
  constraint: McpMaxItemsConstraint,
): ConstraintCheck {
  if (!Array.isArray(value)) {
    return refuse(McpRefusalCode.INVALID_ARGUMENTS, argument, `"${argument}" must be a list`);
  }
  return value.length > constraint.max
    ? refuse(
        McpRefusalCode.TOO_MANY_ITEMS,
        argument,
        `"${argument}" accepts at most ${constraint.max} items`,
      )
    : undefined;
}

function dateRangeProblem(
  range: unknown,
  constraint: McpDateRangesConstraint,
  todayEpochDay: number,
): string | undefined {
  if (!isRecord(range)) {
    return 'each range must be an object';
  }
  const startKey = constraint.startKey ?? DEFAULT_DATE_RANGE_START_KEY;
  const endKey = constraint.endKey ?? DEFAULT_DATE_RANGE_END_KEY;
  const startAgo = daysAgoOf(range[startKey], todayEpochDay);
  const endAgo = daysAgoOf(range[endKey], todayEpochDay);
  if (startAgo === undefined || endAgo === undefined) {
    return `"${startKey}" and "${endKey}" must be YYYY-MM-DD, today, yesterday or NdaysAgo`;
  }
  if (endAgo < -PROPERTY_TIMEZONE_LEAD_DAYS || startAgo < endAgo) {
    return 'a range must not end in the future or before it starts';
  }
  if (startAgo > constraint.maxLookbackDays) {
    return `a range may start at most ${constraint.maxLookbackDays} days ago`;
  }
  if (startAgo - endAgo + 1 > constraint.maxSpanDays) {
    return `a range may cover at most ${constraint.maxSpanDays} days`;
  }
  return undefined;
}

function checkDateRanges(
  argument: string,
  value: unknown,
  constraint: McpDateRangesConstraint,
  todayEpochDay: number,
): ConstraintCheck {
  if (!Array.isArray(value) || value.length === 0) {
    return refuse(
      McpRefusalCode.INVALID_ARGUMENTS,
      argument,
      `"${argument}" must be a non-empty list`,
    );
  }
  if (value.length > constraint.maxRanges) {
    return refuse(
      McpRefusalCode.TOO_MANY_ITEMS,
      argument,
      `"${argument}" accepts at most ${constraint.maxRanges} ranges`,
    );
  }
  const problem = value
    .map((range: unknown) => dateRangeProblem(range, constraint, todayEpochDay))
    .find((found) => found !== undefined);
  return problem === undefined
    ? undefined
    : refuse(McpRefusalCode.DATE_RANGE_NOT_ALLOWED, argument, `"${argument}": ${problem}`);
}

export function checkArgumentConstraint(
  argument: string,
  value: unknown,
  constraint: McpArgumentConstraint,
  todayEpochDay: number,
): ConstraintCheck {
  switch (constraint.kind) {
    case McpConstraintKind.NUMBER:
      return checkNumber(argument, value, constraint);
    case McpConstraintKind.ONE_OF:
      return checkOneOf(argument, value, constraint);
    case McpConstraintKind.MAX_ITEMS:
      return checkMaxItems(argument, value, constraint);
    case McpConstraintKind.DATE_RANGES:
      return checkDateRanges(argument, value, constraint, todayEpochDay);
  }
}
