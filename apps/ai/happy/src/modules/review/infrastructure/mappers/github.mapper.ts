import { z } from 'zod';

import type { ChangedFile, PullRequest, PullRequestRef } from '../../domain/entities/pull-request';
import { FileStatus } from '../../domain/entities/pull-request';

const pullRequestResponse = z.object({
  title: z.string(),
  body: z.string().nullable(),
  draft: z.boolean().optional(),
  user: z.object({ login: z.string() }),
  base: z.object({ ref: z.string(), sha: z.string() }),
  head: z.object({
    sha: z.string(),
    repo: z.object({ full_name: z.string() }).nullable(),
  }),
});

const fileResponse = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().optional(),
});

const changedFilesPageResponse = z.array(fileResponse);

export const directoryEntriesResponse = z.array(
  z.object({ name: z.string(), path: z.string(), type: z.string() }),
);

const STATUS_BY_GITHUB: Readonly<Record<string, FileStatus>> = {
  added: FileStatus.ADDED,
  modified: FileStatus.MODIFIED,
  removed: FileStatus.REMOVED,
  renamed: FileStatus.RENAMED,
};

export const mapPullRequest = (ref: PullRequestRef, payload: unknown): PullRequest => {
  const parsed = pullRequestResponse.parse(payload);
  return {
    ref,
    title: parsed.title,
    body: parsed.body ?? '',
    author: parsed.user.login,
    isDraft: parsed.draft ?? false,
    baseRef: parsed.base.ref,
    baseSha: parsed.base.sha,
    headSha: parsed.head.sha,
    headRepository: parsed.head.repo?.full_name ?? null,
  };
};

export const mapChangedFiles = (payload: unknown): ChangedFile[] =>
  changedFilesPageResponse.parse(payload).map((file) => ({
    path: file.filename,
    status: STATUS_BY_GITHUB[file.status] ?? FileStatus.OTHER,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? null,
  }));
