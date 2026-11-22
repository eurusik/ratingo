import type {
  ChangedFiles,
  OpenPullRequest,
  PullRequest,
  PullRequestRef,
  RepoRuleFile,
} from '../entities/pull-request';

export const CODE_HOST_PORT = Symbol('CODE_HOST_PORT');

export interface FileReadLimits {
  maxBytes: number;
}

export interface ChangedFilesLimits {
  maxFiles: number;
  maxPatchChars: number;
}

export interface CodeHostPort {
  getPullRequest(ref: PullRequestRef): Promise<PullRequest>;
  listOpenPullRequests(
    ref: Pick<PullRequestRef, 'owner' | 'repo'>,
    limit: number,
  ): Promise<OpenPullRequest[]>;
  listChangedFiles(ref: PullRequestRef, limits: ChangedFilesLimits): Promise<ChangedFiles>;
  readFile(
    ref: Pick<PullRequestRef, 'owner' | 'repo'>,
    path: string,
    gitRef: string,
    limits: FileReadLimits,
  ): Promise<string | null>;
  readRuleFiles(
    ref: Pick<PullRequestRef, 'owner' | 'repo'>,
    baseSha: string,
  ): Promise<RepoRuleFile[]>;
}

export class CodeHostError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number | null,
    detail: string,
  ) {
    super(`Code host ${operation} failed${status === null ? '' : ` (${status})`}: ${detail}`);
    this.name = 'CodeHostError';
  }
}
