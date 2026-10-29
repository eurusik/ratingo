export const LINK_PENDING_IMPORTS_SWEEP = Symbol('LINK_PENDING_IMPORTS_SWEEP');

export interface LinkPendingImportsSweepResult {
  linked: number;
  timedOut: number;
}

export interface ILinkPendingImportsSweep {
  execute(): Promise<LinkPendingImportsSweepResult>;
}
