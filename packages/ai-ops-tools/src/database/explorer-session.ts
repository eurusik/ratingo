import type postgres from 'postgres';

import { QueryRefusal } from './database.constants';
import { ExplorerQueryRefusedError } from './database.port';
import { failureOfQuery, isConnectionLoss } from './query-failure.policy';

class ClientDeadlineError extends ExplorerQueryRefusedError {
  constructor() {
    super(QueryRefusal.TIMEOUT, 'the client deadline passed');
    this.name = 'ClientDeadlineError';
  }
}

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
  ) {}

  get reusable(): boolean {
    return !this.broken;
  }

  release(): void {
    this.connection.release();
  }

  async reset(): Promise<void> {
    try {
      await this.control('ROLLBACK');
      await this.control('DISCARD ALL');
    } catch {
      this.broken = true;
    }
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
