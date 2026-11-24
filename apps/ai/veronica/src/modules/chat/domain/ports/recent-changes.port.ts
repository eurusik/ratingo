export interface MergedPullRequest {
  number: number;
  title: string;
  baseBranch: string;
  headBranch: string;
  mergedAtMs: number;
}

export interface DeploymentRecord {
  environment: string;
  state: string;
  atMs: number;
}

export interface ChangeReport {
  mergedPullRequests: MergedPullRequest[];
  deployments: DeploymentRecord[];
}

export interface RecentChangesPort {
  since(sinceMs: number): Promise<ChangeReport>;
}

export const RECENT_CHANGES_PORT = Symbol('RECENT_CHANGES_PORT');

export class ChangesUnavailableError extends Error {
  constructor(reason: string) {
    super(`recent_changes is unavailable: ${reason}`);
    this.name = 'ChangesUnavailableError';
  }
}
