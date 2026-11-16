'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { ImportStep } from './import-wizard';
import { decidePop, isStepEntry, screenOf, type StepEntry } from './step-history';

interface StepHistoryInput {
  step: ImportStep;
  isDesktop: boolean;
  isImporting: boolean;
  stepBack: () => void;
}

function newRunId(): string {
  return crypto.randomUUID();
}

function writeEntry(mode: 'push' | 'replace', entry: StepEntry): void {
  const state: unknown = window.history.state;
  const next = { ...(typeof state === 'object' ? state : {}), ...entry };
  if (mode === 'push') window.history.pushState(next, '');
  else window.history.replaceState(next, '');
}

export function useStepHistory({ step, isDesktop, isImporting, stepBack }: StepHistoryInput) {
  const run = useRef<string>(null);
  const shown = useRef<{ step: ImportStep; screen?: number }>(null);
  const screen = screenOf(step, isDesktop);

  useEffect(() => {
    const previous = shown.current;
    shown.current = { step, screen };
    if (screen === undefined) return;
    if (!run.current || previous?.step === 'result') {
      run.current = newRunId();
      writeEntry('replace', { importRun: run.current, importScreen: screen });
      return;
    }
    if (previous?.screen !== undefined && screen > previous.screen) {
      writeEntry('push', { importRun: run.current, importScreen: screen });
    }
  }, [step, screen]);

  const onPop = useEffectEvent((event: PopStateEvent) => {
    const decision = decidePop({
      target: event.state,
      run: run.current ?? '',
      screen,
      isImporting,
    });
    if (decision.kind === 'stepBack') {
      for (let index = 0; index < decision.steps; index++) stepBack();
      return;
    }
    if (decision.kind === 'stay' && run.current && screen !== undefined) {
      writeEntry('push', { importRun: run.current, importScreen: screen });
      return;
    }
    if (decision.kind === 'leave' || decision.kind === 'snapBack') {
      window.history.go(-decision.distance);
    }
  });

  useEffect(() => {
    const listener = (event: PopStateEvent) => onPop(event);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  return () => {
    const current: unknown = window.history.state;
    const isOwnEntry =
      isStepEntry(current) && current.importRun === run.current && current.importScreen > 0;
    if (isOwnEntry) window.history.back();
    else stepBack();
  };
}
