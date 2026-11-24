import type { ChangesConfig } from '../../../../config/config.constants';
import {
  ChangesUnavailableError,
  type ChangeReport,
  type DeploymentRecord,
  type MergedPullRequest,
  type RecentChangesPort,
} from '../../domain/ports/recent-changes.port';

const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 30;
const DEPLOYMENT_PAGE_SIZE = 10;
const WATCHED_BRANCHES = ['main', 'development'] as const;

interface PullRequestPayload {
  number: number;
  title: string;
  merged_at: string | null;
  base: { ref: string };
  head: { ref: string };
}

interface DeploymentPayload {
  id: number;
  environment: string;
  created_at: string;
}

interface DeploymentStatusPayload {
  state: string;
  created_at: string;
}

export class GithubRecentChangesAdapter implements RecentChangesPort {
  constructor(
    private readonly config: ChangesConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async since(sinceMs: number): Promise<ChangeReport> {
    if (this.config.token === undefined) {
      throw new ChangesUnavailableError('GITHUB_READ_TOKEN is not set');
    }
    const [pullRequests, deployments] = await Promise.all([
      Promise.all(WATCHED_BRANCHES.map((branch) => this.mergedInto(branch, sinceMs))),
      this.recentDeployments(sinceMs),
    ]);
    return {
      mergedPullRequests: pullRequests.flat().sort((a, b) => b.mergedAtMs - a.mergedAtMs),
      deployments,
    };
  }

  private async mergedInto(branch: string, sinceMs: number): Promise<MergedPullRequest[]> {
    const pulls = await this.get<PullRequestPayload[]>(
      `/pulls?state=closed&base=${branch}&sort=updated&direction=desc&per_page=${PAGE_SIZE}`,
    );
    return pulls.flatMap((pull) => {
      const mergedAtMs = pull.merged_at === null ? Number.NaN : Date.parse(pull.merged_at);
      return mergedAtMs >= sinceMs
        ? [
            {
              number: pull.number,
              title: pull.title,
              baseBranch: pull.base.ref,
              headBranch: pull.head.ref,
              mergedAtMs,
            },
          ]
        : [];
    });
  }

  private async recentDeployments(sinceMs: number): Promise<DeploymentRecord[]> {
    const deployments = await this.get<DeploymentPayload[]>(
      `/deployments?per_page=${DEPLOYMENT_PAGE_SIZE}`,
    );
    const recent = deployments.filter((deployment) => Date.parse(deployment.created_at) >= sinceMs);
    return Promise.all(
      recent.map(async (deployment): Promise<DeploymentRecord> => {
        const [latest] = await this.get<DeploymentStatusPayload[]>(
          `/deployments/${deployment.id}/statuses?per_page=1`,
        );
        return {
          environment: deployment.environment,
          state: latest?.state ?? 'unknown',
          atMs: Date.parse(latest?.created_at ?? deployment.created_at),
        };
      }),
    );
  }

  private async get<Payload>(path: string): Promise<Payload> {
    const response = await this.fetchImpl(`${GITHUB_API}/repos/${this.config.repository}${path}`, {
      headers: {
        authorization: `Bearer ${this.config.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': API_VERSION,
        'user-agent': 'ratingo-veronica',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ChangesUnavailableError(`GitHub answered HTTP ${response.status}`);
    }
    return (await response.json()) as Payload;
  }
}
