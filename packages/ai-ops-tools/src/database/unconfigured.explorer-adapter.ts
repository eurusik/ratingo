import {
  EXPLORER_URL_NOT_SET,
  ExplorerNotConfiguredError,
  type ExplorerPort,
  type QueryRows,
  type SchemaListing,
} from './database.port';

export class UnconfiguredExplorerAdapter implements ExplorerPort {
  constructor(private readonly reason: string = EXPLORER_URL_NOT_SET) {}

  async schema(): Promise<SchemaListing> {
    throw new ExplorerNotConfiguredError(this.reason);
  }

  async query(): Promise<QueryRows> {
    throw new ExplorerNotConfiguredError(this.reason);
  }
}
