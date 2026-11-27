import { InvalidRepeatPolicyError, assertRepeatPolicy, majorityPassAt } from './aggregate';

const DEFAULT_REAL_RUNS = 3;
const DEFAULT_STUB_RUNS = 1;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_COST_USD = 12;
const FLAG_PREFIX = '--';
const FLAG_VALUE_SEPARATOR = '=';

const DEFAULT_JUDGE_MODEL = 'anthropic:claude-sonnet-5-5';
const DEFAULT_BASELINE_PATH = 'eval/baseline.json';

export interface EvalOptions {
  runs: number;
  passAt: number;
  concurrency: number;
  maxCostUsd: number;
  judgeModel: string;
  baselinePath: string;
  saveBaseline: boolean;
  only: readonly string[] | null;
  dumpPath: string | null;
}

export class InvalidEvalOptionError extends Error {
  constructor(reason: string) {
    super(`Invalid eval option: ${reason}`);
    this.name = 'InvalidEvalOptionError';
  }
}

const VALUE_FLAGS = [
  'runs',
  'pass-at',
  'concurrency',
  'max-cost-usd',
  'judge-model',
  'baseline',
  'only',
  'dump',
] as const;
const SWITCH_FLAGS = ['save-baseline'] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];
type SwitchFlag = (typeof SWITCH_FLAGS)[number];

const isValueFlag = (name: string): name is ValueFlag => VALUE_FLAGS.some((flag) => flag === name);
const isSwitchFlag = (name: string): name is SwitchFlag =>
  SWITCH_FLAGS.some((flag) => flag === name);

const readFlags = (
  argv: readonly string[],
): { values: Partial<Record<ValueFlag, string>>; switches: ReadonlySet<SwitchFlag> } => {
  const values: Partial<Record<ValueFlag, string>> = {};
  const switches = new Set<SwitchFlag>();
  for (const argument of argv) {
    if (!argument.startsWith(FLAG_PREFIX))
      throw new InvalidEvalOptionError(`unexpected "${argument}"`);
    const [name, ...rest] = argument.slice(FLAG_PREFIX.length).split(FLAG_VALUE_SEPARATOR);
    if (isSwitchFlag(name) && rest.length === 0) switches.add(name);
    else if (isValueFlag(name) && rest.length > 0) values[name] = rest.join(FLAG_VALUE_SEPARATOR);
    else throw new InvalidEvalOptionError(`unknown or incomplete flag "${argument}"`);
  }
  return { values, switches };
};

const positiveNumber = (flag: string, raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new InvalidEvalOptionError(`--${flag} needs a positive number, got "${raw}"`);
  return parsed;
};

const nonEmpty = (raw: string | undefined): string | null =>
  raw === undefined || raw.trim() === '' ? null : raw.trim();

export const parseEvalOptions = (argv: readonly string[], stubModel: boolean): EvalOptions => {
  const { values, switches } = readFlags(argv);
  const runs = positiveNumber(
    'runs',
    values.runs,
    stubModel ? DEFAULT_STUB_RUNS : DEFAULT_REAL_RUNS,
  );
  const passAt = positiveNumber('pass-at', values['pass-at'], majorityPassAt(runs));
  try {
    assertRepeatPolicy({ runs, passAt });
  } catch (error) {
    if (error instanceof InvalidRepeatPolicyError) throw new InvalidEvalOptionError(error.message);
    throw error;
  }
  const only =
    nonEmpty(values.only)
      ?.split(',')
      .map((id) => id.trim()) ?? null;
  const saveBaseline = switches.has('save-baseline');
  if (saveBaseline && only !== null)
    throw new InvalidEvalOptionError('--save-baseline cannot be combined with --only');
  return {
    runs,
    passAt,
    concurrency: positiveNumber('concurrency', values.concurrency, DEFAULT_CONCURRENCY),
    maxCostUsd: positiveNumber('max-cost-usd', values['max-cost-usd'], DEFAULT_MAX_COST_USD),
    judgeModel: nonEmpty(values['judge-model']) ?? DEFAULT_JUDGE_MODEL,
    baselinePath: nonEmpty(values.baseline) ?? DEFAULT_BASELINE_PATH,
    saveBaseline,
    only,
    dumpPath: nonEmpty(values.dump),
  };
};
