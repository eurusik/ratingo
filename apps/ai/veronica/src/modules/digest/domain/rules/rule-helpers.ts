import type { DigestBlock } from '../constants/digest-block.constants';
import type { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, Fact, FactUnit } from '../entities/digest';
import type { Measured } from '../entities/measured';

export const factOf = (label: string, unit: FactUnit, value: Measured): Fact => ({
  label,
  unit,
  current: value.current,
  baseline: value.baseline,
});

export const itemOf = (
  id: string,
  block: DigestBlock,
  level: DigestLevel,
  advice: string,
  facts: Fact[] = [],
): DigestItem => ({ id, block, level, advice, facts });

export const sumMeasured = (values: readonly Measured[]): Measured => ({
  current: values.reduce((total, value) => total + value.current, 0),
  baseline: values.every((value) => value.baseline !== null)
    ? values.reduce((total, value) => total + (value.baseline ?? 0), 0)
    : null,
});

export const share = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);

export const BYTES_PER_MEGABYTE = 1024 * 1024;
export const HOURS_PER_DAY = 24;
export const PERCENT = 100;
