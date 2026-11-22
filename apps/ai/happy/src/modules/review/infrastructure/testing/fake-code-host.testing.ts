import type {
  ChangedFile,
  ChangedFiles,
  PullRequest,
  PullRequestRef,
  RepoRuleFile,
} from '../../domain/entities/pull-request';
import { FileStatus, PullRequestState } from '../../domain/entities/pull-request';
import type { CodeHostPort, FileReadLimits } from '../../domain/ports/code-host.port';

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
  rules: RepoRuleFile[];
}

export class FakeCodeHost implements CodeHostPort {
  readonly reads: string[] = [];

  constructor(readonly data: FakeCodeHostData) {}

  async getPullRequest(): Promise<PullRequest> {
    return this.data.pr;
  }

  async listChangedFiles(): Promise<ChangedFiles> {
    return { files: this.data.files, truncated: false };
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
    rules: [],
    ...overrides,
  });
