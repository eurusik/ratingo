import type { QueryRefusal } from './database.constants';

export interface SchemaColumn {
  name: string;
  type: string;
  enumValues?: readonly string[];
}

export interface SchemaTable {
  name: string;
  kind: 'table' | 'view';
  rowEstimate: number | null;
  columns: readonly SchemaColumn[];
  privateColumnCount: number;
}

export interface SchemaListing {
  tables: readonly SchemaTable[];
  privateTables: readonly string[];
}

export interface QueryRequest {
  sql: string;
  explain: boolean;
  rowLimit: number;
}

export interface QueryRows {
  columns: readonly string[];
  rows: readonly Record<string, unknown>[];
  hasMoreRows: boolean;
}

export interface ExplorerPort {
  schema(): Promise<SchemaListing>;
  query(request: QueryRequest): Promise<QueryRows>;
}

export class ExplorerFailureError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'ExplorerFailureError';
  }
}

export const EXPLORER_URL_NOT_SET = 'AI_EXPLORER_DATABASE_URL is not set';
export const EXPLORER_URL_INVALID = 'AI_EXPLORER_DATABASE_URL is not a valid connection string';

export class ExplorerNotConfiguredError extends ExplorerFailureError {
  constructor(reason: string = EXPLORER_URL_NOT_SET) {
    super(reason);
    this.name = 'ExplorerNotConfiguredError';
  }
}

export class ExplorerUnavailableError extends Error {
  constructor(
    readonly tool: string,
    readonly reason: string,
  ) {
    super(`${tool} is unavailable: ${reason}`);
    this.name = 'ExplorerUnavailableError';
  }
}

export class ExplorerQueryRefusedError extends Error {
  constructor(
    readonly refusal: QueryRefusal,
    message: string,
  ) {
    super(message);
    this.name = 'ExplorerQueryRefusedError';
  }
}
