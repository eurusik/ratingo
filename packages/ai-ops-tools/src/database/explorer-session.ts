import type postgres from 'postgres';

import type { OpsLogger } from '../shared/ops-logger.port';

import { QueryRefusal } from './database.constants';
import { ExplorerFailureError, ExplorerQueryRefusedError } from './database.port';
import { failureOfQuery, isConnectionLoss } from './query-failure.policy';

class ClientDeadlineError extends ExplorerQueryRefusedError {
  constructor() {
    super(QueryRefusal.TIMEOUT, 'the client deadline passed');
    this.name = 'ClientDeadlineError';
  }
}

const reasonOf = (error: unknown): string => {
  const failure = failureOfQuery(error);
  return failure instanceof ExplorerFailureError ? failure.reason : failure.refusal;
};

type StatementOptions = postgres.UnsafeQueryOptions & { simple: boolean };

const EXTENDED_PROTOCOL: StatementOptions = { simple: false };
const SIMPLE_PROTOCOL: StatementOptions = { simple: true };

export interface StatementDescription {
  columns: readonly { name: string; type: number }[];
}

export class ExplorerSession {
  private broken = false;

  constructor(
    private readonly connection: postgres.ReservedSql,
    private readonly deadlineMs: number,
    private readonly logger: OpsLogger,
  ) {}

  get reusable(): boolean {
    return !this.broken;
  }

  release(): void {
    this.connection.release();
  }

  async reset(): Promise<boolean> {
    for (const step of ['ROLLBACK', 'DISCARD ALL']) {
      try {
        await this.control(step);
      } catch (error) {
        this.broken = true;
        this.logger.warn(
          `the database explorer connection is replaced: ${step} failed (${reasonOf(error)})`,
        );
        return false;
      }
    }
    return true;
  }

  async control(statement: string): Promise<void> {
    await this.guarded(this.connection.unsafe(statement, [], SIMPLE_PROTOCOL));
  }

  run(statement: string) {
    return this.guarded(this.connection.unsafe(statement, [], EXTENDED_PROTOCOL));
  }

  async describe(statement: string): Promise<StatementDescription> {
    const described = await this.guarded(
      this.connection.unsafe(statement, [], EXTENDED_PROTOCOL).describe(),
    );
    return { columns: described.columns.map(({ name, type }) => ({ name, type })) };
  }

  private async guarded<T>(pending: PromiseLike<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new ClientDeadlineError()), this.deadlineMs);
    });
    try {
      return await Promise.race([pending, deadline]);
    } catch (error) {
      if (error instanceof ClientDeadlineError || isConnectionLoss(failureOfQuery(error))) {
        this.broken = true;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
