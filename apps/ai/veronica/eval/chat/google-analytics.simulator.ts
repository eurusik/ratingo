import {
  civilFromDays,
  daysFromCivil,
} from '../../src/modules/chat/domain/policies/report-dates.policy';

import {
  GA_DERIVED_RATIOS,
  GA_EVAL_TODAY,
  GA_EVENTS_PER_USER,
  GA_REALTIME_TABLE,
  GA_REPORT_TABLES,
  type Fact,
  type FactTable,
} from './google-analytics.dataset';

type Json = Record<string, unknown>;

export type GaSimulation = { ok: true; body: Json } | { ok: false; error: string };

class GaRequestError extends Error {}

const DATE_RANGE = 'dateRange';
const DEFAULT_FUNNEL_RANGE = [{ start_date: '28daysAgo', end_date: 'yesterday' }];
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
  for (const [ratio, parts] of Object.entries(GA_DERIVED_RATIOS)) {
    if (parts.every((part) => knownMetrics.has(part))) knownMetrics.add(ratio);
  }
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

interface MetricSource {
  table: FactTable;
  metrics: string[];
}

const RATIO_DECIMALS = 4;

const baseMetricsOf = (metrics: readonly string[]): string[] => [
  ...new Set(metrics.flatMap((metric) => GA_DERIVED_RATIOS[metric] ?? [metric])),
];

const sourcesFor = (
  tables: readonly FactTable[],
  dimensions: string[],
  metrics: string[],
): MetricSource[] => {
  const sources = new Map<FactTable, string[]>();
  for (const metric of metrics) {
    const table = tables.find(
      (candidate) =>
        candidate.metrics.includes(metric) &&
        dimensions.every((name) => name === DATE_RANGE || candidate.dimensions.includes(name)),
    );
    if (table === undefined) {
      throw new GaRequestError(
        `400 Please remove ${metric} to make the request compatible. The request's dimensions & metrics are incompatible.`,
      );
    }
    sources.set(table, [...(sources.get(table) ?? []), metric]);
  }
  return [...sources].map(([table, tableMetrics]) => ({ table, metrics: tableMetrics }));
};

const metricValue = (metric: string, totals: ReadonlyMap<string, number>): number => {
  const ratio = GA_DERIVED_RATIOS[metric];
  if (ratio === undefined) {
    return totals.get(metric) ?? 0;
  }
  const denominator = totals.get(ratio[1]) ?? 0;
  return denominator === 0
    ? 0
    : Number(((totals.get(ratio[0]) ?? 0) / denominator).toFixed(RATIO_DECIMALS));
};

interface Slice {
  name: string;
  facts: readonly Fact[];
}

interface Group {
  keys: string[];
  totals: Map<string, number>;
}

const addFacts = (
  groups: Map<string, Group>,
  slices: readonly Slice[],
  dimensions: string[],
  source: MetricSource,
  withRangeName: boolean,
): void => {
  for (const slice of slices) {
    for (const fact of slice.facts) {
      const keys = dimensions.map((name) =>
        name === DATE_RANGE ? slice.name : String(fact[name]),
      );
      const allKeys =
        withRangeName && !dimensions.includes(DATE_RANGE) ? [...keys, slice.name] : keys;
      const id = JSON.stringify(allKeys);
      const group = groups.get(id) ?? { keys: allKeys, totals: new Map<string, number>() };
      for (const metric of source.metrics) {
        group.totals.set(metric, (group.totals.get(metric) ?? 0) + Number(fact[metric] ?? 0));
      }
      groups.set(id, group);
    }
  }
};

const aggregate = (
  sources: readonly MetricSource[],
  slicesOf: (table: FactTable) => Slice[],
  dimensions: string[],
  metrics: string[],
) => {
  const groups = new Map<string, Group>();
  const slicesBySource = sources.map((source) => ({ source, slices: slicesOf(source.table) }));
  const withRangeName = (slicesBySource[0]?.slices.length ?? 0) > 1;
  for (const { source, slices } of slicesBySource) {
    addFacts(groups, slices, dimensions, source, withRangeName);
  }
  const rows = [...groups.values()].map((group) => ({
    keys: group.keys,
    sums: metrics.map((metric) => metricValue(metric, group.totals)),
  }));
  return { rows, withRangeName };
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
    metric_headers: metrics.map((name) => ({
      name,
      type_: name in GA_DERIVED_RATIOS ? 'TYPE_FLOAT' : 'TYPE_INTEGER',
    })),
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
  const sources = sourcesFor(tables, fields, baseMetricsOf(metrics));
  const { rows, withRangeName } = aggregate(sources, slicesOf, dimensions, metrics);
  return responseOf({
    kind,
    dimensions,
    metrics,
    rows: ordered(rows, dimensions, metrics, args.order_bys),
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

const FUNNEL_STEP_NAME = 'funnelStepName';
const FUNNEL_BREAKDOWNS: ReadonlySet<string> = new Set(['deviceCategory']);
const STEP_CARRY_OVER = 0.8;
const FUNNEL_METRICS = [
  'activeUsers',
  'funnelStepCompletionRate',
  'funnelStepAbandonments',
  'funnelStepAbandonmentRate',
];

const stepEvent = (step: Json): string => {
  if (typeof step.event === 'string') return step.event;
  const expression = isRecord(step.filter_expression) ? step.filter_expression : {};
  const eventFilter = isRecord(expression.funnel_event_filter)
    ? expression.funnel_event_filter
    : {};
  return String(eventFilter.event_name ?? '');
};

const usersByEvent = (facts: readonly Fact[], event: string): number =>
  Math.round(
    facts
      .filter((fact) => fact.eventName === event)
      .reduce((sum, fact) => sum + Number(fact.eventCount), 0) / (GA_EVENTS_PER_USER[event] ?? 1),
  );

const funnelUsers = (facts: readonly Fact[], events: readonly string[]): number[] =>
  events.reduce<number[]>((users, event, index) => {
    const reached = usersByEvent(facts, event);
    const previous = users[index - 1];
    return [
      ...users,
      previous === undefined ? reached : Math.min(previous, Math.round(reached * STEP_CARRY_OVER)),
    ];
  }, []);

const stepMetrics = (count: number, next: number | undefined): number[] => {
  if (next === undefined || count === 0) {
    return [count, 0, 0, 0];
  }
  const completion = next / count;
  return [count, completion, count - next, 1 - completion];
};

const funnelRows = (
  names: readonly string[],
  users: readonly number[],
  prefix: readonly string[],
) =>
  users.map((count, index) => ({
    dimension_values: [...prefix, `${index + 1}. ${names[index]}`].map((value) => ({ value })),
    metric_values: stepMetrics(count, users[index + 1]).map((value) => ({ value: String(value) })),
  }));

const funnelBreakdownOf = (args: Json): string | undefined => {
  const requested = isRecord(args.funnel_breakdown)
    ? args.funnel_breakdown.breakdown_dimension
    : undefined;
  if (typeof requested !== 'string') {
    return undefined;
  }
  if (!FUNNEL_BREAKDOWNS.has(requested)) {
    throw new GaRequestError(
      `400 Field ${requested} is not available as a funnel breakdown in the eval data.`,
    );
  }
  return requested;
};

const breakdownGroups = (facts: readonly Fact[], breakdown: string | undefined) =>
  breakdown === undefined
    ? [{ prefix: [] as string[], facts }]
    : [...new Set(facts.map((fact) => String(fact[breakdown])))].map((value) => ({
        prefix: [value],
        facts: facts.filter((fact) => String(fact[breakdown]) === value),
      }));

const funnelFacts = (args: Json): readonly Fact[] => {
  const table = GA_REPORT_TABLES.find((candidate) => candidate.name === 'events') as FactTable;
  return (
    dateSlices(table, { ...args, date_ranges: args.date_ranges ?? DEFAULT_FUNNEL_RANGE })[0]
      ?.facts ?? []
  );
};

export const simulateRunFunnelReport = (args: Json): GaSimulation =>
  simulate(() => {
    const steps = Array.isArray(args.funnel_steps) ? args.funnel_steps.filter(isRecord) : [];
    if (steps.length === 0) {
      throw new GaRequestError('400 funnel_steps must contain at least one step');
    }
    const breakdown = funnelBreakdownOf(args);
    const events = steps.map(stepEvent);
    const names = steps.map((step, index) => String(step.name ?? `Step ${index + 1}`));
    const facts = funnelFacts(args);
    const tableRows = breakdownGroups(facts, breakdown).flatMap((group) =>
      funnelRows(names, funnelUsers(group.facts, events), group.prefix),
    );
    return {
      funnel_table: {
        dimension_headers: [...(breakdown === undefined ? [] : [breakdown]), FUNNEL_STEP_NAME].map(
          (name) => ({ name }),
        ),
        metric_headers: FUNNEL_METRICS.map((name) => ({ name, type_: 'TYPE_INTEGER' })),
        rows: tableRows,
        metadata: {},
      },
      funnel_visualization: {
        dimension_headers: [{ name: FUNNEL_STEP_NAME }],
        metric_headers: [{ name: 'activeUsers', type_: 'TYPE_INTEGER' }],
        rows: funnelRows(names, funnelUsers(facts, events), []).map((row) => ({
          dimension_values: row.dimension_values,
          metric_values: row.metric_values.slice(0, 1),
        })),
      },
      kind: 'analyticsData#runFunnelReport',
    };
  });

export const simulatedFunnelUsers = (args: Json): number[] => {
  const result = simulateRunFunnelReport(args);
  if (!result.ok) {
    throw new GaRequestError(result.error);
  }
  const rows = ((result.body.funnel_visualization as Json).rows ?? []) as {
    metric_values: { value: string }[];
  }[];
  return rows.map((row) => Number(row.metric_values[0]?.value ?? 0));
};

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
