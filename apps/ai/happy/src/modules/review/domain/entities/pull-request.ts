export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

export const PullRequestState = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;
export type PullRequestState = (typeof PullRequestState)[keyof typeof PullRequestState];

export interface PullRequest {
  ref: PullRequestRef;
  state: PullRequestState;
  merged: boolean;
  title: string;
  body: string;
  author: string;
  isDraft: boolean;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  headRepository: string | null;
}

export interface OpenPullRequest {
  number: number;
  title: string;
  author: string;
  updatedAt: string;
}

export const FileStatus = {
  ADDED: 'added',
  MODIFIED: 'modified',
  REMOVED: 'removed',
  RENAMED: 'renamed',
  OTHER: 'other',
} as const;
export type FileStatus = (typeof FileStatus)[keyof typeof FileStatus];

export interface ChangedFile {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface ChangedFiles {
  files: ChangedFile[];
  truncated: boolean;
}

export interface RepoRuleFile {
  path: string;
  content: string;
}

export const formatRepository = (ref: PullRequestRef): string => `${ref.owner}/${ref.repo}`;

export const formatPullRequest = (ref: PullRequestRef): string =>
  `${formatRepository(ref)}#${ref.number}`;
