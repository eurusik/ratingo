import type { MetricSample } from '../metrics/metrics.port';

const HTTP_OK = 200;
const SECONDS_PER_MS = 1000;
const QUERY_SHAPE =
  /^(max_over_time\()?sum(?: by \(([^)]*)\))?\s*\(?(?:increase\()?([A-Za-z_:][\w:]*)(?:\{([^}]*)\})?/;
const MATCHER = /([A-Za-z_]\w*)\s*(=~|=)\s*"([^"]*)"/g;

export interface PrometheusSeries {
  metric: string;
  labels: Readonly<Record<string, string>>;
  value: number;
  peak?: number;
}

interface Matcher {
  label: string;
  regex: boolean;
  expected: string;
}

interface ParsedQuery {
  metric: string;
  groupBy: readonly string[];
  matchers: readonly Matcher[];
  peak: boolean;
}

const parseQuery = (promql: string): ParsedQuery | null => {
  const shape = QUERY_SHAPE.exec(promql);
  if (shape === null) return null;
  const [, peak, groupBy, metric, selector] = shape;
  return {
    metric: metric as string,
    groupBy: (groupBy ?? '')
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label !== ''),
    matchers: [...(selector ?? '').matchAll(MATCHER)].map(([, label, operator, expected]) => ({
      label: label as string,
      regex: operator === '=~',
      expected: expected as string,
    })),
    peak: peak !== undefined,
  };
};

const satisfies = (series: PrometheusSeries, matcher: Matcher): boolean => {
  const actual = series.labels[matcher.label] ?? '';
  return matcher.regex
    ? new RegExp(`^(?:${matcher.expected})$`).test(actual)
    : actual === matcher.expected;
};

const evaluate = (query: ParsedQuery, series: readonly PrometheusSeries[]): MetricSample[] => {
  const selected = series.filter(
    (entry) =>
      entry.metric === query.metric && query.matchers.every((matcher) => satisfies(entry, matcher)),
  );
  const groups = new Map<string, { labels: Record<string, string>; value: number }>();
  for (const entry of selected) {
    const labels = Object.fromEntries(
      query.groupBy.map((label) => [label, entry.labels[label] ?? '']),
    );
    const key = JSON.stringify(labels);
    const value = query.peak ? (entry.peak ?? entry.value) : entry.value;
    groups.set(key, { labels, value: (groups.get(key)?.value ?? 0) + value });
  }
  return [...groups.values()];
};

export const createPrometheusSimulator =
  (series: readonly PrometheusSeries[], nowMs: number): typeof fetch =>
  async (input) => {
    const parsed = parseQuery(new URL(String(input)).searchParams.get('query') ?? '');
    const samples = parsed === null ? [] : evaluate(parsed, series);
    const body = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: samples.map((sample) => ({
          metric: sample.labels,
          value: [nowMs / SECONDS_PER_MS, String(sample.value)],
        })),
      },
    };
    return new Response(JSON.stringify(body), {
      status: HTTP_OK,
      headers: { 'content-type': 'application/json' },
    });
  };
