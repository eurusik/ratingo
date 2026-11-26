import { EVAL_NOW_MS } from './eval-clock';
import type { LokiScenario, SimulatedLogRecord } from './loki.dataset';

const NANOS_PER_MS = 1_000_000n;
const HTTP_BAD_REQUEST = 400;
const HTTP_OK = 200;
const EXACT_LABELS = ['queue', 'job_id', 'request_id', 'run_id'] as const;
const METADATA_KEYS = ['context', 'error_name', 'job_id', 'queue', 'request_id', 'run_id'] as const;

const Q = '`';
const ESCAPED_OR_PLAIN =
  String.raw`(?:\\[\\.+*?()|[\]{}^$]|[^\\` + Q + String.raw`|.+*?()[\]{}^$\n])+`;
const PATTERN_PREFIX = String.raw`\(\?is\)\.\*`;
const PATTERN_SUFFIX = String.raw`\.\*`;
const TEXT_STAGES =
  String.raw` \| json message="message", error_message="error_message"` +
  String.raw` \| message=~` +
  Q +
  PATTERN_PREFIX +
  `(${ESCAPED_OR_PLAIN})` +
  PATTERN_SUFFIX +
  Q +
  String.raw` or error_message=~` +
  Q +
  PATTERN_PREFIX +
  String.raw`\4` +
  PATTERN_SUFFIX +
  Q +
  String.raw` \| drop message, error_message`;
const EXACT_STAGE =
  String.raw` \| (?:queue|job_id|request_id|run_id)=` + Q + '[A-Za-z0-9_.:-]+' + Q;
const QUERY_SHAPE = new RegExp(
  String.raw`^\{service_name=` +
    Q +
    '(ratingo-[a-z]+)' +
    Q +
    String.raw`,deployment_environment_name=` +
    Q +
    'production' +
    Q +
    String.raw`\}` +
    String.raw` \| detected_level(=` +
    Q +
    'error' +
    Q +
    String.raw`|=~` +
    Q +
    String.raw`warn\|error` +
    Q +
    ')' +
    `((?:${EXACT_STAGE})*)(?:${TEXT_STAGES})?$`,
  'u',
);
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
    text: text === undefined ? null : new RegExp(text, 'isu'),
  };
};

const bodyOf = (record: SimulatedLogRecord): Record<string, string | number> => ({
  time: new Date(record.atMs).toISOString(),
  level: record.level,
  service: record.service,
  environment: 'production',
  ...record.fields,
});

const textOf = (record: SimulatedLogRecord): string[] =>
  [record.fields.message, record.fields.error_message].map((value) => String(value ?? ''));

const matches = (record: SimulatedLogRecord, query: ParsedQuery): boolean =>
  record.service === query.service &&
  query.levels.includes(record.level) &&
  EXACT_LABELS.every(
    (label) =>
      query.exact[label] === undefined || String(record.fields[label]) === query.exact[label],
  ) &&
  (query.text === null || textOf(record).some((field) => query.text?.test(field) === true));

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
      .filter(({ record }) => matches(record, query))
      .sort((left, right) => right.record.atMs - left.record.atMs)
      .slice(0, limit)
      .map(({ record, line }) => streamOf(record, line));
    return json(HTTP_OK, { status: 'success', data: { resultType: 'streams', result: streams } });
  };
