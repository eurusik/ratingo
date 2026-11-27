import {
  ExplorerEvalRuntime,
  missingExplorerDatabaseExecutors,
  unconfiguredExplorerExecutors,
} from './explorer-eval-runtime';
import type { ExplorerExecutorOptions, ExplorerExecutors } from './explorer-eval-runtime';

export const EXPLORER_EVAL_DATABASE_VARIABLE = 'EXPLORER_EVAL_DATABASE_URL';

export interface ExplorerCasePlan<T> {
  runnable: readonly T[];
  skipped: readonly string[];
  notice: string | null;
}

export const planExplorerCases = <T extends { id: string }>(
  cases: readonly T[],
  needsDatabase: (testCase: T) => boolean,
  adminUrl: string | undefined,
): ExplorerCasePlan<T> => {
  if (adminUrl !== undefined && adminUrl !== '') {
    return { runnable: cases, skipped: [], notice: null };
  }
  const skipped = cases.filter(needsDatabase).map((testCase) => testCase.id);
  return {
    runnable: cases.filter((testCase) => !needsDatabase(testCase)),
    skipped,
    notice:
      skipped.length === 0
        ? null
        : `skipped ${skipped.length} cases that need the throwaway database (${EXPLORER_EVAL_DATABASE_VARIABLE} is not set): ${skipped.join(', ')}`,
  };
};

export class ExplorerEvalSession {
  private running: ExplorerEvalRuntime | null = null;

  constructor(private readonly migrationsFolder: string) {}

  async start(adminUrl: string): Promise<void> {
    if (this.running !== null) return;
    this.running = await ExplorerEvalRuntime.start({
      adminUrl,
      migrationsFolder: this.migrationsFolder,
    });
  }

  async stop(): Promise<void> {
    const current = this.running;
    this.running = null;
    await current?.close();
  }

  executorsFor(scenario: ExplorerExecutorOptions | undefined, caseId: string): ExplorerExecutors {
    if (scenario === undefined) return unconfiguredExplorerExecutors();
    if (this.running === null) {
      return missingExplorerDatabaseExecutors(
        `Case ${caseId} needs ${EXPLORER_EVAL_DATABASE_VARIABLE}`,
      );
    }
    return this.running.executors(scenario);
  }
}
