import type { DigestBlock } from '../constants/digest-block.constants';
import type { DigestLevel } from '../constants/digest-level.constants';
import type { DigestSource } from '../constants/digest-source.constants';
import type { SourceState } from './source-reading';

export const FactUnit = {
  COUNT: 'count',
  HOURS: 'hours',
  AGE_HOURS: 'age_hours',
  PERCENT: 'percent',
  MEGABYTES: 'megabytes',
  MILLISECONDS: 'milliseconds',
} as const;
export type FactUnit = (typeof FactUnit)[keyof typeof FactUnit];

export interface Fact {
  label: string;
  unit: FactUnit;
  current: number | null;
  baseline: number | null;
}

export interface DigestItem {
  id: string;
  block: DigestBlock;
  level: DigestLevel;
  advice: string;
  facts: Fact[];
}

export interface RuleOutcome {
  items: DigestItem[];
  facts: Fact[];
}

export interface BlockReport {
  block: DigestBlock;
  items: DigestItem[];
  facts: Fact[];
}

export interface SourceStatus {
  source: DigestSource;
  state: SourceState;
  reason?: string;
}

export interface Digest {
  date: string;
  level: DigestLevel;
  blocks: BlockReport[];
  sources: SourceStatus[];
}

export interface DigestText {
  headline: string;
  adviceById: Readonly<Record<string, string>>;
  interesting?: string;
}

export interface RenderedMessage {
  html: string;
  silent: boolean;
}
