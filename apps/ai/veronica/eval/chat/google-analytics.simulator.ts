import {
  civilFromDays,
  daysFromCivil,
} from '../../src/modules/chat/domain/policies/report-dates.policy';

import {
  GA_EVAL_TODAY,
  GA_REALTIME_TABLE,
  GA_REPORT_TABLES,
  type Fact,
  type FactTable,
} from './google-analytics.dataset';

type Json = Record<string, unknown>;

export type GaSimulation = { ok: true; body: Json } | { ok: false; error: string };

class GaRequestError extends Error {}

const DATE_RANGE = 'dateRange';
const API_SCHEMA_URL =
  'https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema';
const DAYS_AGO = /^(\d{1,3})daysAgo$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RELATIVE: Readonly<Record<string, number>> = { today: 0, yesterday: 1 };
const STRING_MATCH = {
  EXACT: [1, 'EXACT'],
  BEGINS_WITH: [2, 'BEGINS_WITH'],
  ENDS_WITH: [3, 'ENDS_WITH'],
  CONTAINS: [4, 'CONTAINS'],
} as const;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const pad = (value: number): string => String(value).padStart(2, '0');

const compactDate = (value: string): string => {
  const today = ISO_DATE.exec(GA_EVAL_TODAY);
  const todayDays = daysFromCivil({
    year: Number(today?.[1]),
    month: Number(today?.[2]),
    day: Number(today?.[3]),
  });
  const iso = ISO_DATE.exec(value);
  if (iso !== null) {
    return `${iso[1]}${iso[2]}${iso[3]}`;
  }
  const ago = RELATIVE[value] ?? Number(DAYS_AGO.exec(value)?.[1] ?? Number.NaN);
  if (!Number.isFinite(ago)) {
    throw new GaRequestError(
      `400 Invalid date: ${value}. Use YYYY-MM-DD, NdaysAgo, yesterday or today.`,
    );
  }
  const date = civilFromDays(todayDays - ago);
  return `${date.year}${pad(date.month)}${pad(date.day)}`;
};

const stringMatches = (actual: string, filter: Json): boolean => {
  const value = String(filter.value ?? '');
  const caseSensitive = filter.case_sensitive === true;
  const [left, right] = caseSensitive
    ? [actual, value]
    : [actual.toLowerCase(), value.toLowerCase()];
  const type = filter.match_type ?? STRING_MATCH.EXACT[0];
  const is = (kind: readonly [number, string]) => kind.includes(type as never);
  if (is(STRING_MATCH.BEGINS_WITH)) return left.startsWith(right);
  if (is(STRING_MATCH.ENDS_WITH)) return left.endsWith(right);
  if (is(STRING_MATCH.CONTAINS)) return left.includes(right);
  return left === right;
};

const filterFields = (expression: unknown): string[] => {
  if (!isRecord(expression)) return [];
  if (isRecord(expression.filter)) return [String(expression.filter.field_name ?? '')];
  if (isRecord(expression.not_expression)) return filterFields(expression.not_expression);
  const group = isRecord(expression.and_group) ? expression.and_group : expression.or_group;
  return isRecord(group) && Array.isArray(group.expressions)
    ? group.expressions.flatMap(filterFields)
    : [];
};

const passes = (expression: unknown, fact: Fact): boolean => {
  if (!isRecord(expression)) return true;
  if (isRecord(expression.not_expression)) return !passes(expression.not_expression, fact);
  if (isRecord(expression.and_group) && Array.isArray(expression.and_group.expressions)) {
    return expression.and_group.expressions.every((inner) => passes(inner, fact));
  }
  if (isRecord(expression.or_group) && Array.isArray(expression.or_group.expressions)) {
    return expression.or_group.expressions.some((inner) => passes(inner, fact));
  }
  const filter = isRecord(expression.filter) ? expression.filter : {};
  const actual = String(fact[String(filter.field_name)] ?? '');
  if (isRecord(filter.string_filter)) return stringMatches(actual, filter.string_filter);
  if (isRecord(filter.in_list_filter)) {
    const values = stringList(filter.in_list_filter.values);
    return filter.in_list_filter.case_sensitive === true
      ? values.includes(actual)
      : values.map((value) => value.toLowerCase()).includes(actual.toLowerCase());
  }
  throw new GaRequestError(
    '400 Only string_filter and in_list_filter are available in the eval data.',
  );
};

const validateNames = (
  tables: readonly FactTable[],
  dimensions: string[],
  metrics: string[],
): void => {
  const knownDimensions = new Set([DATE_RANGE, ...tables.flatMap((table) => table.dimensions)]);
  const knownMetrics = new Set(tables.flatMap((table) => table.metrics));
  const badDimension = dimensions.find((name) => !knownDimensions.has(name));
  if (badDimension !== undefined) {
    throw new GaRequestError(
      `400 Field ${badDimension} is not a valid dimension. For a list of valid dimensions and metrics, see ${API_SCHEMA_URL}`,
    );
  }
  const badMetric = metrics.find((name) => !knownMetrics.has(name));
  if (badMetric !== undefined) {
    throw new GaRequestError(
      `400 Field ${badMetric} is not a valid metric. For a list of valid dimensions and metrics, see ${API_SCHEMA_URL}`,
    );
  }
  if (metrics.length === 0) {
    throw new GaRequestError('400 A report needs at least one metric.');
  }
};

const tableFor = (
  tables: readonly FactTable[],
  dimensions: string[],
  metrics: string[],
): FactTable => {
  const table = tables.find(
    (candidate) =>
      dimensions.every((name) => name === DATE_RANGE || candidate.dimensions.includes(name)) &&
      metrics.every((name) => candidate.metrics.includes(name)),
  );
  if (table === undefined) {
    throw new GaRequestError(
      `400 Please remove ${metrics[0] ?? dimensions[0]} to make the request compatible. The request's dimensions & metrics are incompatible.`,
    );
  }
  return table;
};

interface Slice {
  name: string;
  facts: readonly Fact[];
}

const aggregate = (
  slices: readonly Slice[],
  dimensions: string[],
  metrics: string[],
  withRangeName: boolean,
) => {
  const groups = new Map<string, { keys: string[]; sums: number[] }>();
  for (const slice of slices) {
    for (const fact of slice.facts) {
      const keys = dimensions.map((name) =>
        name === DATE_RANGE ? slice.name : String(fact[name]),
      );
      const allKeys =
        withRangeName && !dimensions.includes(DATE_RANGE) ? [...keys, slice.name] : keys;
      const id = JSON.stringify(allKeys);
      const group = groups.get(id) ?? { keys: allKeys, sums: metrics.map(() => 0) };
      metrics.forEach((metric, index) => {
        group.sums[index] = (group.sums[index] ?? 0) + Number(fact[metric] ?? 0);
      });
      groups.set(id, group);
    }
  }
  return [...groups.values()];
};

const ordered = (
  rows: { keys: string[]; sums: number[] }[],
  dimensions: string[],
  metrics: string[],
  orderBys: unknown,
) => {
  const order = Array.isArray(orderBys) ? orderBys.filter(isRecord) : [];
  const compareBy =
    (by: Json) =>
    (left: { keys: string[]; sums: number[] }, right: { keys: string[]; sums: number[] }) => {
      const direction = by.desc === true ? -1 : 1;
      if (isRecord(by.metric)) {
        const index = metrics.indexOf(String(by.metric.metric_name));
        return direction * ((left.sums[index] ?? 0) - (right.sums[index] ?? 0));
      }
      if (isRecord(by.dimension)) {
        const index = dimensions.indexOf(String(by.dimension.dimension_name));
        return direction * (left.keys[index] ?? '').localeCompare(right.keys[index] ?? '');
      }
      return 0;
    };
  const comparators =
    order.length > 0
      ? order.map(compareBy)
      : [compareBy({ metric: { metric_name: metrics[0] }, desc: true })];
  return [...rows].sort((left, right) => {
    for (const compare of comparators) {
      const result = compare(left, right);
      if (result !== 0) return result;
    }
    return left.keys.join().localeCompare(right.keys.join());
  });
};

interface ReportShape {
  kind: string;
  dimensions: string[];
  metrics: string[];
  rows: { keys: string[]; sums: number[] }[];
  limit: number | undefined;
  withRangeName: boolean;
}

const responseOf = ({
  kind,
  dimensions,
  metrics,
  rows,
  limit,
  withRangeName,
}: ReportShape): Json => {
  const headers =
    withRangeName && !dimensions.includes(DATE_RANGE) ? [...dimensions, DATE_RANGE] : dimensions;
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  return {
    dimension_headers: headers.map((name) => ({ name })),
    metric_headers: metrics.map((name) => ({ name, type_: 'TYPE_INTEGER' })),
    rows: shown.map((row) => ({
      dimension_values: row.keys.map((value) => ({ value })),
      metric_values: row.sums.map((value) => ({ value: String(value) })),
    })),
    row_count: rows.length,
    metadata: { currency_code: 'USD', time_zone: 'Europe/Kiev' },
    kind,
  };
};

interface Query {
  kind: string;
  tables: readonly FactTable[];
  args: Json;
  slicesOf: (table: FactTable) => Slice[];
}

const runQuery = ({ kind, tables, args, slicesOf }: Query): Json => {
  const dimensions = stringList(args.dimensions);
  const metrics = stringList(args.metrics);
  const fields = [...dimensions, ...filterFields(args.dimension_filter)];
  validateNames(tables, fields, metrics);
  const slices = slicesOf(tableFor(tables, fields, metrics));
  const withRangeName = slices.length > 1;
  return responseOf({
    kind,
    dimensions,
    metrics,
    rows: ordered(
      aggregate(slices, dimensions, metrics, withRangeName),
      dimensions,
      metrics,
      args.order_bys,
    ),
    limit: typeof args.limit === 'number' ? args.limit : undefined,
    withRangeName,
  });
};

const simulate = (run: () => Json): GaSimulation => {
  try {
    return { ok: true, body: run() };
  } catch (error) {
    if (error instanceof GaRequestError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
};

const rangeName = (range: Json, index: number): string =>
  typeof range.name === 'string' && range.name.length > 0 ? range.name : `date_range_${index}`;

const dateSlices = (table: FactTable, args: Json): Slice[] => {
  const ranges = Array.isArray(args.date_ranges) ? args.date_ranges.filter(isRecord) : [];
  if (ranges.length === 0) {
    throw new GaRequestError('400 date_ranges is required.');
  }
  return ranges.map((range, index) => {
    const [start, end] = [
      compactDate(String(range.start_date)),
      compactDate(String(range.end_date)),
    ];
    return {
      name: rangeName(range, index),
      facts: table.facts.filter(
        (fact) =>
          String(fact.date) >= start &&
          String(fact.date) <= end &&
          passes(args.dimension_filter, fact),
      ),
    };
  });
};

const FULL_REALTIME_WINDOW = { start_minutes_ago: 29, end_minutes_ago: 0 };

const minuteSlices = (table: FactTable, args: Json): Slice[] => {
  const ranges = Array.isArray(args.minute_ranges) ? args.minute_ranges.filter(isRecord) : [];
  const windows = ranges.length > 0 ? ranges : [FULL_REALTIME_WINDOW];
  return windows.map((range, index) => ({
    name: rangeName(range, index),
    facts: table.facts.filter((fact) => {
      const minutes = Number(fact.minutesAgo);
      return (
        minutes <= Number(range.start_minutes_ago ?? FULL_REALTIME_WINDOW.start_minutes_ago) &&
        minutes >= Number(range.end_minutes_ago ?? FULL_REALTIME_WINDOW.end_minutes_ago) &&
        passes(args.dimension_filter, fact)
      );
    }),
  }));
};

export const simulateRunReport = (args: Json): GaSimulation =>
  simulate(() => {
    if (args.metric_filter !== undefined && args.metric_filter !== null) {
      throw new GaRequestError('400 metric_filter is not available in the eval data.');
    }
    return runQuery({
      kind: 'analyticsData#runReport',
      tables: GA_REPORT_TABLES,
      args,
      slicesOf: (table) => dateSlices(table, args),
    });
  });

export const simulateRunRealtimeReport = (args: Json): GaSimulation =>
  simulate(() => {
    const { metadata: _metadata, ...realtime } = runQuery({
      kind: 'analyticsData#runRealtimeReport',
      tables: [GA_REALTIME_TABLE],
      args,
      slicesOf: (table) => minuteSlices(table, args),
    });
    return realtime;
  });

export interface SimulatedRow {
  keys: string[];
  value: number;
}

export const simulatedRows = (result: GaSimulation): SimulatedRow[] => {
  if (!result.ok) {
    throw new GaRequestError(result.error);
  }
  const rows = (result.body.rows ?? []) as {
    dimension_values: { value: string }[];
    metric_values: { value: string }[];
  }[];
  return rows.map((row) => ({
    keys: row.dimension_values.map((cell) => cell.value),
    value: Number(row.metric_values[0]?.value ?? 0),
  }));
};
