import type { CodeSnapshot } from '../entities/code-snapshot';

export interface CodeSnapshotPort {
  resolve(ref: string): Promise<CodeSnapshot>;
  dispose?(): Promise<void>;
}

export const CODE_SNAPSHOT_PORT = Symbol('CODE_SNAPSHOT_PORT');
