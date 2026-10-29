import { type LinkPendingImportsSweepResult } from './link-pending-imports-sweep.port';

export const IMPORT_LINK_METRICS = Symbol('IMPORT_LINK_METRICS');

export interface IImportLinkMetrics {
  recordSweep(result: LinkPendingImportsSweepResult): void;
}
