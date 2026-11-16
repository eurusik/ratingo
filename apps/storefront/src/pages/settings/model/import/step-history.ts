import type { ImportStep } from './import-wizard';

export interface StepEntry {
  importRun: string;
  importScreen: number;
}

export type PopDecision =
  | { kind: 'stepBack'; steps: number }
  | { kind: 'leave'; distance: number }
  | { kind: 'snapBack'; distance: number }
  | { kind: 'stay' }
  | { kind: 'none' };

const PHONE_SCREENS: Partial<Record<ImportStep, number>> = { source: 0, files: 1, preview: 2 };
const DESKTOP_SCREENS: Partial<Record<ImportStep, number>> = { source: 0, files: 0, preview: 1 };

export function screenOf(step: ImportStep, isDesktop: boolean): number | undefined {
  return (isDesktop ? DESKTOP_SCREENS : PHONE_SCREENS)[step];
}

export function isStepEntry(value: unknown): value is StepEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<StepEntry>;
  return typeof entry.importRun === 'string' && typeof entry.importScreen === 'number';
}

interface PopContext {
  target: unknown;
  run: string;
  screen: number | undefined;
  isImporting: boolean;
}

export function decidePop({ target, run, screen, isImporting }: PopContext): PopDecision {
  if (!isStepEntry(target)) return { kind: 'none' };
  const isCurrentRun = target.importRun === run;
  if (isCurrentRun && isImporting) return { kind: 'stay' };
  if (isCurrentRun && screen !== undefined) {
    if (target.importScreen < screen)
      return { kind: 'stepBack', steps: screen - target.importScreen };
    if (target.importScreen === screen) return { kind: 'none' };
    return { kind: 'snapBack', distance: target.importScreen - screen };
  }
  return { kind: 'leave', distance: target.importScreen + 1 };
}
