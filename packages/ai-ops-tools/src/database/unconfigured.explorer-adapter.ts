import {
  ExplorerNotConfiguredError,
  type ExplorerPort,
  type QueryRows,
  type SchemaListing,
} from './database.port';

export class UnconfiguredExplorerAdapter implements ExplorerPort {
  async schema(): Promise<SchemaListing> {
    throw new ExplorerNotConfiguredError();
  }

  async query(): Promise<QueryRows> {
    throw new ExplorerNotConfiguredError();
  }
}
