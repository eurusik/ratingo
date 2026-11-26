import { EVAL_NOW_MS } from './eval-clock';
import { API_QUIET, LOKI_ACCESS_DENIED, WORKER_TROUBLE } from './loki.dataset';
import { simulatedLokiFetch } from './loki.simulator';

const HOUR_MS = 3_600_000;
const SELECTOR = (service: string) =>
  `{service_name=\`${service}\`,deployment_environment_name=\`production\`}`;

const ask = async (
  logql: string,
  scenario = WORKER_TROUBLE,
  range: { startMs: number; endMs: number } = {
    startMs: EVAL_NOW_MS - 24 * HOUR_MS,
    endMs: EVAL_NOW_MS,
  },
  limit = 500,
) => {
  const url = new URL('https://loki.eval.invalid/loki/api/v1/query_range');
  url.searchParams.set('query', logql);
  url.searchParams.set('start', `${range.startMs}000000`);
  url.searchParams.set('end', `${range.endMs}000000`);
  url.searchParams.set('limit', String(limit));
  const response = await simulatedLokiFetch(scenario)(url);
  const body = (await response.json()) as {
    data?: { result: { stream: Record<string, string>; values: [string, string][] }[] };
  };
  return { status: response.status, streams: body.data?.result ?? [] };
};

const linesOf = (streams: { values: [string, string][] }[]): Record<string, unknown>[] =>
  streams.flatMap((stream) =>
    stream.values.map(([, line]) => JSON.parse(line) as Record<string, unknown>),
  );

describe('simulated Loki', () => {
  it('answers a query of the built shape with the service errors, newest first', async () => {
    const { status, streams } = await ask(
      `${SELECTOR('ratingo-worker')} | detected_level=\`error\``,
    );

    expect(status).toBe(200);
    const records = linesOf(streams);
    expect(records.length).toBeGreaterThan(10);
    expect(records.every((record) => record.level === 'error')).toBe(true);
    expect(records.every((record) => record.service === 'ratingo-worker')).toBe(true);
    const times = records.map((record) => Date.parse(String(record.time)));
    expect(times).toEqual([...times].sort((left, right) => right - left));
  });

  it('includes errors for the warn level and filters on structured metadata and text', async () => {
    const warn = await ask(
      `${SELECTOR('ratingo-worker')} | detected_level=~\`warn|error\` | job_id=\`sync-show:4812\``,
    );
    expect(linesOf(warn.streams).map((record) => record.level)).toEqual(['error', 'warn']);

    const text = await ask(
      `${SELECTOR('ratingo-worker')} | detected_level=\`error\` | json message="message", error_message="error_message" | message=~\`(?is).*TRAKT api: 429.*\` or error_message=~\`(?is).*TRAKT api: 429.*\` | drop message, error_message`,
    );
    expect(linesOf(text.streams)).toHaveLength(3);

    const queue = await ask(
      `${SELECTOR('ratingo-worker')} | detected_level=\`error\` | queue=\`stats-queue\``,
    );
    expect(queue.streams).toEqual([]);
  });

  it('does not match a word that is only a field name or a value outside the message', async () => {
    const stages = (text: string) =>
      `${SELECTOR('ratingo-worker')} | detected_level=\`error\` | json message="message", error_message="error_message" | message=~\`(?is).*${text}.*\` or error_message=~\`(?is).*${text}.*\` | drop message, error_message`;
    for (const word of ['environment', 'level', 'queue', 'ratingo-worker', 'production']) {
      expect((await ask(stages(word))).streams).toEqual([]);
    }
    expect(linesOf((await ask(stages('TMDB request timed out'))).streams)).toHaveLength(14);
  });

  it('keeps to the time range and the limit', async () => {
    const recent = await ask(
      `${SELECTOR('ratingo-worker')} | detected_level=\`error\``,
      WORKER_TROUBLE,
      { startMs: EVAL_NOW_MS - HOUR_MS, endMs: EVAL_NOW_MS },
    );
    expect(linesOf(recent.streams)).toHaveLength(1);

    const limited = await ask(
      `${SELECTOR('ratingo-worker')} | detected_level=\`error\``,
      WORKER_TROUBLE,
      undefined,
      4,
    );
    expect(linesOf(limited.streams)).toHaveLength(4);
  });

  it('has nothing for a service without matching records', async () => {
    const { streams } = await ask(
      `${SELECTOR('ratingo-api')} | detected_level=\`error\``,
      API_QUIET,
    );
    expect(streams).toEqual([]);
  });

  it.each([
    '{service_name=~`.+`} | detected_level=`error`',
    `${SELECTOR('ratingo-worker')} | json | detected_level=\`error\``,
    `${SELECTOR('ratingo-worker')} | detected_level=\`error\` | line_format \`x\``,
    `${SELECTOR('ratingo-worker')} | detected_level=\`error\` |~ \`a|b\``,
    `${SELECTOR('ratingo-worker')} | detected_level=\`error\` |~ \`(?i)timed out\``,
    '',
  ])('refuses the query «%s» that is outside the shapes Veronica builds', async (logql) => {
    expect((await ask(logql)).status).toBe(400);
  });

  it('can fail the way the scenario says', async () => {
    const { status } = await ask(
      `${SELECTOR('ratingo-worker')} | detected_level=\`error\``,
      LOKI_ACCESS_DENIED,
    );
    expect(status).toBe(401);
  });
});
