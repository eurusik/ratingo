import type { CheckReport } from '../../domain/entities/check-report';
import type {
  ChangedFile,
  ChangedFiles,
  CommitComparison,
  OpenPullRequest,
  PullRequest,
  PullRequestRef,
  RepoRuleFile,
} from '../../domain/entities/pull-request';
import { isIgnoredFile } from '../../domain/policies/skip-policy';
import {
  CHECK_RUN_NAME,
  type CheckRunPublisherPort,
} from '../../domain/ports/check-run-publisher.port';
import {
  CodeHostError,
  type ChangedFilesLimits,
  type CodeHostPort,
  type FileReadLimits,
} from '../../domain/ports/code-host.port';
import type { GithubTokenProvider } from '../auth/github-token.provider';
import {
  directoryEntriesResponse,
  mapChangedFiles,
  mapCommitShas,
  mapComparison,
  mapOpenPullRequests,
  mapPublishedChecks,
  mapPullRequest,
} from '../mappers/github.mapper';
import type { PublishedCheck, PublishedCheckPort } from '../../domain/ports/published-check.port';

const PAGE_SIZE = 100;
const NOT_FOUND = 404;
const API_VERSION = '2022-11-28';
const RULES_FILE = 'CLAUDE.md';
const RULES_DIRECTORY = '.claude/rules';
const MARKDOWN_SUFFIX = '.md';
const DIRECTORY_ENTRY_TYPE = 'file';
const COMPARE_FILES_CAP = 300;
const LAST_PAGE_PATTERN = /[?&]page=(\d+)[^>]*>;\s*rel="last"/;

export interface GithubCodeHostConfig {
  tokens: GithubTokenProvider;
  apiUrl: string;
  appId?: string;
  fetchFn?: typeof fetch;
}

type RepositoryRef = Pick<PullRequestRef, 'owner' | 'repo'>;

interface PatchBudget {
  patchChars: number;
  truncated: boolean;
}

const applyPatchBudget = (
  file: ChangedFile,
  limits: ChangedFilesLimits,
  budget: PatchBudget,
): ChangedFile => {
  if (file.patch === null) return file;
  if (isIgnoredFile(file.path)) return { ...file, patch: null };
  if (budget.patchChars + file.patch.length > limits.maxPatchChars) {
    budget.truncated = true;
    return { ...file, patch: null };
  }
  budget.patchChars += file.patch.length;
  return file;
};

export class GithubCodeHostAdapter
  implements CodeHostPort, CheckRunPublisherPort, PublishedCheckPort
{
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: GithubCodeHostConfig) {
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async getPullRequest(ref: PullRequestRef): Promise<PullRequest> {
    const response = await this.request('get pull request', ref, this.pullPath(ref));
    return mapPullRequest(ref, await response.json());
  }

  async listOpenPullRequests(ref: RepositoryRef, limit: number): Promise<OpenPullRequest[]> {
    const response = await this.request(
      'list open pull requests',
      ref,
      `${this.repositoryPath(ref)}/pulls?state=open&sort=updated&direction=desc&per_page=${limit}`,
    );
    return mapOpenPullRequests(await response.json());
  }

  async listChangedFiles(ref: PullRequestRef, limits: ChangedFilesLimits): Promise<ChangedFiles> {
    const files: ChangedFile[] = [];
    const budget = { patchChars: 0, truncated: false };
    let morePages = true;
    for (let page = 1; morePages && files.length < limits.maxFiles; page += 1) {
      const response = await this.request(
        'list changed files',
        ref,
        `${this.pullPath(ref)}/files?per_page=${PAGE_SIZE}&page=${page}`,
      );
      const batch = mapChangedFiles(await response.json());
      morePages = batch.length === PAGE_SIZE;
      const room = limits.maxFiles - files.length;
      files.push(...batch.slice(0, room).map((file) => applyPatchBudget(file, limits, budget)));
      budget.truncated =
        budget.truncated || batch.length > room || (morePages && room <= PAGE_SIZE);
    }
    return { files, truncated: budget.truncated };
  }

  async compareCommits(
    ref: RepositoryRef,
    baseSha: string,
    headSha: string,
    limits: ChangedFilesLimits,
  ): Promise<CommitComparison> {
    const response = await this.request(
      'compare commits',
      ref,
      `${this.repositoryPath(ref)}/compare/${encodeURIComponent(baseSha)}...${encodeURIComponent(headSha)}`,
    );
    const { relation, files } = mapComparison(await response.json());
    const budget = { patchChars: 0, truncated: files.length >= COMPARE_FILES_CAP };
    const limited = files
      .slice(0, limits.maxFiles)
      .map((file) => applyPatchBudget(file, limits, budget));
    return {
      relation,
      files: limited,
      truncated: budget.truncated || files.length > limits.maxFiles,
    };
  }

  async readFile(
    ref: RepositoryRef,
    path: string,
    gitRef: string,
    limits: FileReadLimits,
  ): Promise<string | null> {
    const response = await this.request(
      'read file',
      ref,
      `${this.contentsPath(ref, path)}?ref=${encodeURIComponent(gitRef)}`,
      { accept: 'application/vnd.github.raw+json', allowNotFound: true },
    );
    if (response.status === NOT_FOUND) {
      return null;
    }
    return (await response.text()).slice(0, limits.maxBytes);
  }

  async readRuleFiles(ref: RepositoryRef, baseSha: string): Promise<RepoRuleFile[]> {
    const limits = { maxBytes: 100_000 };
    const names = await this.listRuleFileNames(ref, baseSha);
    const files = await Promise.all(
      [RULES_FILE, ...names].map(async (path) => ({
        path,
        content: await this.readFile(ref, path, baseSha, limits),
      })),
    );
    return files.flatMap((file) =>
      file.content === null ? [] : [{ ...file, content: file.content }],
    );
  }

  private async listRuleFileNames(ref: RepositoryRef, baseSha: string): Promise<string[]> {
    const response = await this.request(
      'list rules',
      ref,
      `${this.contentsPath(ref, RULES_DIRECTORY)}?ref=${encodeURIComponent(baseSha)}`,
      { allowNotFound: true },
    );
    if (response.status === NOT_FOUND) {
      return [];
    }
    return directoryEntriesResponse
      .parse(await response.json())
      .filter(
        (entry) => entry.type === DIRECTORY_ENTRY_TYPE && entry.name.endsWith(MARKDOWN_SUFFIX),
      )
      .map((entry) => entry.path)
      .sort();
  }

  async publish(ref: PullRequestRef, headSha: string, report: CheckReport): Promise<void> {
    await this.request('publish check run', ref, this.checkRunsPath(ref), {
      method: 'POST',
      body: {
        name: CHECK_RUN_NAME,
        head_sha: headSha,
        status: 'completed',
        conclusion: report.conclusion,
        output: {
          title: report.title,
          summary: report.summary,
          annotations: report.annotations.map((annotation) => ({
            path: annotation.path,
            start_line: annotation.line,
            end_line: annotation.line,
            annotation_level: annotation.level,
            title: annotation.title,
            message: annotation.message,
          })),
        },
      },
    });
  }

  async findForCommit(ref: PullRequestRef, sha: string): Promise<PublishedCheck | null> {
    const response = await this.request(
      'find check run',
      ref,
      `${this.repositoryPath(ref)}/commits/${encodeURIComponent(sha)}/check-runs?check_name=${encodeURIComponent(CHECK_RUN_NAME)}&filter=latest&per_page=${PAGE_SIZE}`,
    );
    const [latest] = mapPublishedChecks(await response.json(), CHECK_RUN_NAME, this.config.appId);
    return latest ?? null;
  }

  async listRecentCommitShas(ref: PullRequestRef, limit: number): Promise<string[]> {
    const path = `${this.pullPath(ref)}/commits?per_page=${limit}`;
    const first = await this.request('list commits', ref, `${path}&page=1`);
    const lastPage = LAST_PAGE_PATTERN.exec(first.headers.get('link') ?? '')?.[1];
    const response =
      lastPage === undefined
        ? first
        : await this.request('list commits', ref, `${path}&page=${lastPage}`);
    return mapCommitShas(await response.json()).reverse();
  }

  private repositoryPath(ref: RepositoryRef): string {
    return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  }

  private checkRunsPath(ref: RepositoryRef): string {
    return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/check-runs`;
  }

  private pullPath(ref: PullRequestRef): string {
    return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}`;
  }

  private contentsPath(ref: RepositoryRef, path: string): string {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encoded}`;
  }

  private async request(
    operation: string,
    repository: RepositoryRef,
    path: string,
    options: { accept?: string; allowNotFound?: boolean; method?: 'POST'; body?: unknown } = {},
  ): Promise<Response> {
    const token = await this.config.tokens.tokenFor(repository);
    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.apiUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: options.accept ?? 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'ratingo-happy',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch {
      throw new CodeHostError(operation, null, 'network error');
    }
    if (response.ok || (options.allowNotFound === true && response.status === NOT_FOUND)) {
      return response;
    }
    throw new CodeHostError(operation, response.status, response.statusText);
  }
}
