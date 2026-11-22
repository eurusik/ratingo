import type {
  ChangedFile,
  ChangedFiles,
  CommitComparison,
  OpenPullRequest,
  PullRequest,
  PullRequestRef,
  RepoRuleFile,
} from '../../domain/entities/pull-request';
import { CommitRelation, FileStatus, PullRequestState } from '../../domain/entities/pull-request';
import type { CodeHostPort, FileReadLimits } from '../../domain/ports/code-host.port';
import type { PublishedCheck, PublishedCheckPort } from '../../domain/ports/published-check.port';

export const TEST_REF: PullRequestRef = { owner: 'acme', repo: 'shop', number: 7 };

export const buildPullRequest = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  ref: TEST_REF,
  state: PullRequestState.OPEN,
  merged: false,
  title: 'Add checkout',
  body: 'Adds the checkout flow',
  author: 'alice',
  isDraft: false,
  baseRef: 'main',
  baseSha: 'base111',
  headRef: 'feature/checkout',
  headSha: 'head222',
  headRepository: 'acme/shop',
  ...overrides,
});

export const buildChangedFile = (overrides: Partial<ChangedFile> = {}): ChangedFile => ({
  path: 'src/checkout.ts',
  status: FileStatus.MODIFIED,
  additions: 30,
  deletions: 2,
  patch: '@@ -1,3 +1,4 @@\n const a = 1;\n+const b = 2;\n const c = 3;\n const d = 4;',
  ...overrides,
});

export interface FakeCodeHostData {
  pr: PullRequest;
  files: ChangedFile[];
  contents: Record<string, string>;
  open: OpenPullRequest[];
  rules: RepoRuleFile[];
  comparison: CommitComparison | Error;
}

export class FakeCodeHost implements CodeHostPort {
  readonly reads: string[] = [];

  constructor(readonly data: FakeCodeHostData) {}

  async getPullRequest(): Promise<PullRequest> {
    return this.data.pr;
  }

  async listOpenPullRequests(): Promise<OpenPullRequest[]> {
    return this.data.open;
  }

  async listChangedFiles(): Promise<ChangedFiles> {
    return { files: this.data.files, truncated: false };
  }

  async compareCommits(): Promise<CommitComparison> {
    if (this.data.comparison instanceof Error) throw this.data.comparison;
    return this.data.comparison;
  }

  async readFile(
    _ref: Pick<PullRequestRef, 'owner' | 'repo'>,
    path: string,
    gitRef: string,
    limits: FileReadLimits,
  ): Promise<string | null> {
    this.reads.push(`${gitRef}:${path}`);
    return this.data.contents[`${gitRef}:${path}`]?.slice(0, limits.maxBytes) ?? null;
  }

  async readRuleFiles(): Promise<RepoRuleFile[]> {
    return this.data.rules;
  }
}

export const buildFakeCodeHost = (overrides: Partial<FakeCodeHostData> = {}): FakeCodeHost =>
  new FakeCodeHost({
    pr: buildPullRequest(),
    files: [buildChangedFile()],
    contents: {},
    open: [],
    rules: [],
    comparison: { relation: CommitRelation.AHEAD, files: [], truncated: false },
    ...overrides,
  });

export class FakePublishedChecks implements PublishedCheckPort {
  constructor(
    private readonly checks: ReadonlyMap<string, PublishedCheck>,
    private readonly recentShas: readonly string[],
  ) {}

  async findForCommit(_ref: PullRequestRef, sha: string): Promise<PublishedCheck | null> {
    return this.checks.get(sha) ?? null;
  }

  async listRecentCommitShas(): Promise<string[]> {
    return [...this.recentShas];
  }
}
