import type { EvalCase } from '../eval-case';
import { ANSWERABLE_CASES } from './answerable.cases';
import { INJECTION_CASES } from './injection.cases';
import { RUNTIME_CASES } from './runtime.cases';
import { UNKNOWN_CASES } from './unknown.cases';

export const EVAL_CASES: readonly EvalCase[] = [
  ...ANSWERABLE_CASES,
  ...UNKNOWN_CASES,
  ...INJECTION_CASES,
  ...RUNTIME_CASES,
];
