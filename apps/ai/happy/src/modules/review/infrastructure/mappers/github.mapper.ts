import { z } from 'zod';

import type { ChangedFile, PullRequest, PullRequestRef } from '../../domain/entities/pull-request';
import { decodeResultMarker } from '../state/review-result-marker.codec';
import type { PublishedCheck } from '../../domain/ports/published-check.port';
import { FileStatus, PullRequestState } from '../../domain/entities/pull-request';

const pullRequestResponse = z.object({
  title: z.string(),
  state: z.string(),
  merged: z.boolean().optional(),
  body: z.string().nullable(),
  draft: z.boolean().optional(),
  user: z.object({ login: z.string() }),
  base: z.object({ ref: z.string(), sha: z.string() }),
  head: z.object({
    ref: z.string(),
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

const checkRunsResponse = z.object({
  check_runs: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      html_url: z.string().nullable().optional(),
      head_sha: z.string(),
      app: z.object({ id: z.number() }).nullable().optional(),
      output: z.object({ title: z.string().nullable(), summary: z.string().nullable() }),
    }),
  ),
});

const commitsResponse = z.array(z.object({ sha: z.string() }));

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
    state: parsed.state === 'open' ? PullRequestState.OPEN : PullRequestState.CLOSED,
    merged: parsed.merged ?? false,
    title: parsed.title,
    body: parsed.body ?? '',
    author: parsed.user.login,
    isDraft: parsed.draft ?? false,
    baseRef: parsed.base.ref,
    baseSha: parsed.base.sha,
    headRef: parsed.head.ref,
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

const GITHUB_WEB_PREFIX = 'https://github.com/';

export const mapPublishedChecks = (
  payload: unknown,
  checkName: string,
  appId: string | undefined,
): PublishedCheck[] =>
  checkRunsResponse
    .parse(payload)
    .check_runs.filter(
      (run) =>
        run.name === checkName &&
        run.status === 'completed' &&
        (appId === undefined || String(run.app?.id) === appId),
    )
    .map((run) => ({
      headSha: run.head_sha,
      title: run.output.title ?? '',
      snapshot: decodeResultMarker(run.output.summary ?? ''),
      url: run.html_url?.startsWith(GITHUB_WEB_PREFIX) === true ? run.html_url : null,
    }));

export const mapCommitShas = (payload: unknown): string[] =>
  commitsResponse.parse(payload).map((commit) => commit.sha);
