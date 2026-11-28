import { join } from 'node:path';

import {
  ExplorerEvalRuntime,
  missingExplorerDatabaseExecutors,
  unconfiguredExplorerExecutors,
} from './explorer-eval-runtime';
import type { ExplorerExecutorOptions, ExplorerExecutors } from './explorer-eval-runtime';

export const EXPLORER_EVAL_DATABASE_VARIABLE = 'EXPLORER_EVAL_DATABASE_URL';

const API_MIGRATIONS_FOLDER = join(__dirname, '../../../../apps/api/drizzle_v2');

export interface ExplorerCasePlan<T> {
  runnable: readonly T[];
  skipped: readonly string[];
  notice: string | null;
}

export class ExplorerEvalSession {
  private running: ExplorerEvalRuntime | null = null;

  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly migrationsFolder: string = API_MIGRATIONS_FOLDER,
  ) {}

  get adminUrl(): string | undefined {
    const value = this.environment[EXPLORER_EVAL_DATABASE_VARIABLE];
    return value === undefined || value === '' ? undefined : value;
  }

  async startIfConfigured(): Promise<boolean> {
    const adminUrl = this.adminUrl;
    if (adminUrl === undefined) return false;
    if (this.running === null) {
      this.running = await ExplorerEvalRuntime.start({
        adminUrl,
        migrationsFolder: this.migrationsFolder,
      });
    }
    return true;
  }

  async stop(): Promise<void> {
    const current = this.running;
    this.running = null;
    await current?.close();
  }

  plan<T extends { id: string }>(
    cases: readonly T[],
    needsDatabase: (testCase: T) => boolean,
  ): ExplorerCasePlan<T> {
    if (this.adminUrl !== undefined) return { runnable: cases, skipped: [], notice: null };
    const skipped = cases.filter(needsDatabase).map((testCase) => testCase.id);
    return {
      runnable: cases.filter((testCase) => !needsDatabase(testCase)),
      skipped,
      notice:
        skipped.length === 0
          ? null
          : `skipped ${skipped.length} cases that need the throwaway database (${EXPLORER_EVAL_DATABASE_VARIABLE} is not set): ${skipped.join(', ')}`,
    };
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
