import { EVAL_NOW_MS } from './eval-clock';
import type { LokiScenario, SimulatedLogRecord } from './loki.dataset';

const NANOS_PER_MS = 1_000_000n;
const HTTP_BAD_REQUEST = 400;
const HTTP_OK = 200;
const EXACT_LABELS = ['queue', 'job_id', 'request_id', 'run_id'] as const;
const METADATA_KEYS = ['context', 'error_name', 'job_id', 'queue', 'request_id', 'run_id'] as const;

const QUERY_SHAPE =
  /^\{service_name=`(ratingo-[a-z]+)`,deployment_environment_name=`production`\} \| detected_level(=`error`|=~`warn\|error`)((?: \| (?:queue|job_id|request_id|run_id)=`[A-Za-z0-9_.:-]+`)*)(?: \|~ `\(\?i\)((?:\\[\\.+*?()|[\]{}^$]|[^\\`|.+*?()[\]{}^$\n])+)`)?$/u;
const EXACT_FILTER = /\| (queue|job_id|request_id|run_id)=`([^`]+)`/gu;

interface ParsedQuery {
  service: string;
  levels: readonly string[];
  exact: Readonly<Record<string, string>>;
  text: RegExp | null;
}

const parseQuery = (logql: string): ParsedQuery | null => {
  const match = QUERY_SHAPE.exec(logql);
  if (match === null) return null;
  const [, service, level, exactFilters, text] = match;
  return {
    service,
    levels: level === '=`error`' ? ['error'] : ['warn', 'error'],
    exact: Object.fromEntries(
      [...exactFilters.matchAll(EXACT_FILTER)].map(([, label, value]) => [label, value]),
    ),
    text: text === undefined ? null : new RegExp(text, 'iu'),
  };
};

const bodyOf = (record: SimulatedLogRecord): Record<string, string | number> => ({
  time: new Date(record.atMs).toISOString(),
  level: record.level,
  service: record.service,
  environment: 'production',
  ...record.fields,
});

const matches = (record: SimulatedLogRecord, query: ParsedQuery, line: string): boolean =>
  record.service === query.service &&
  query.levels.includes(record.level) &&
  EXACT_LABELS.every(
    (label) =>
      query.exact[label] === undefined || String(record.fields[label]) === query.exact[label],
  ) &&
  (query.text === null || query.text.test(line));

const streamOf = (record: SimulatedLogRecord, line: string) => ({
  stream: {
    service_name: record.service,
    deployment_environment_name: 'production',
    detected_level: record.level,
    ...Object.fromEntries(
      METADATA_KEYS.filter((key) => record.fields[key] !== undefined).map((key) => [
        key,
        String(record.fields[key]),
      ]),
    ),
  },
  values: [[(BigInt(record.atMs) * NANOS_PER_MS).toString(), line]],
});

const nanosToMs = (nanos: string | null): number => Number(BigInt(nanos ?? '0') / NANOS_PER_MS);

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const simulatedLokiFetch =
  (scenario: LokiScenario): typeof fetch =>
  async (input) => {
    if (scenario.failWithStatus !== undefined) {
      return json(scenario.failWithStatus, { message: 'simulated failure' });
    }
    const url = new URL(String(input));
    const query = parseQuery(url.searchParams.get('query') ?? '');
    if (query === null) {
      return json(HTTP_BAD_REQUEST, { message: 'query outside the shapes Veronica builds' });
    }
    const startMs = nanosToMs(url.searchParams.get('start'));
    const endMs = Math.min(nanosToMs(url.searchParams.get('end')), EVAL_NOW_MS);
    const limit = Number(url.searchParams.get('limit'));
    const streams = scenario.records
      .map((record) => ({ record, line: JSON.stringify(bodyOf(record)) }))
      .filter(({ record }) => record.atMs >= startMs && record.atMs < endMs + 1)
      .filter(({ record, line }) => matches(record, query, line))
      .sort((left, right) => right.record.atMs - left.record.atMs)
      .slice(0, limit)
      .map(({ record, line }) => streamOf(record, line));
    return json(HTTP_OK, { status: 'success', data: { resultType: 'streams', result: streams } });
  };
