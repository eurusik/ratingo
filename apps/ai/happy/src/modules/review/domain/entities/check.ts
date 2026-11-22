import type { Severity } from '../constants/severity.constants';

export interface RuleReference {
  file: string;
  heading: string | null;
}

export interface Check {
  id: string;
  area: string;
  summary: string;
  paths: readonly string[];
  triggers: readonly string[];
  rule: RuleReference | null;
  severityCap: Severity;
  body: string;
}

export const CheckOutcome = {
  SELECTED: 'selected',
  FINDING: 'finding',
  QUESTION: 'question',
} as const;
export type CheckOutcome = (typeof CheckOutcome)[keyof typeof CheckOutcome];

export interface ExtraCheckRequest {
  id: string;
  file: string;
}
