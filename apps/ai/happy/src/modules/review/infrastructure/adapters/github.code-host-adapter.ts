import type {
  ChangedFile,
  ChangedFiles,
  PullRequest,
  PullRequestRef,
  RepoRuleFile,
} from '../../domain/entities/pull-request';
import { isIgnoredFile } from '../../domain/policies/skip-policy';
import {
  CodeHostError,
  type ChangedFilesLimits,
  type CodeHostPort,
  type FileReadLimits,
} from '../../domain/ports/code-host.port';
import {
  directoryEntriesResponse,
  mapChangedFiles,
  mapPullRequest,
} from '../mappers/github.mapper';

const PAGE_SIZE = 100;
const NOT_FOUND = 404;
const API_VERSION = '2022-11-28';
const RULES_FILE = 'CLAUDE.md';
const RULES_DIRECTORY = '.claude/rules';
const MARKDOWN_SUFFIX = '.md';
const DIRECTORY_ENTRY_TYPE = 'file';

export interface GithubCodeHostConfig {
  token: string;
  apiUrl: string;
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

export class GithubCodeHostAdapter implements CodeHostPort {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: GithubCodeHostConfig) {
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async getPullRequest(ref: PullRequestRef): Promise<PullRequest> {
    const response = await this.request('get pull request', this.pullPath(ref));
    return mapPullRequest(ref, await response.json());
  }

  async listChangedFiles(ref: PullRequestRef, limits: ChangedFilesLimits): Promise<ChangedFiles> {
    const files: ChangedFile[] = [];
    const budget = { patchChars: 0, truncated: false };
    let morePages = true;
    for (let page = 1; morePages && files.length < limits.maxFiles; page += 1) {
      const response = await this.request(
        'list changed files',
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

  async readFile(
    ref: RepositoryRef,
    path: string,
    gitRef: string,
    limits: FileReadLimits,
  ): Promise<string | null> {
    const response = await this.request(
      'read file',
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

  private pullPath(ref: PullRequestRef): string {
    return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}`;
  }

  private contentsPath(ref: RepositoryRef, path: string): string {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encoded}`;
  }

  private async request(
    operation: string,
    path: string,
    options: { accept?: string; allowNotFound?: boolean } = {},
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.apiUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: options.accept ?? 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'ratingo-happy',
        },
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
