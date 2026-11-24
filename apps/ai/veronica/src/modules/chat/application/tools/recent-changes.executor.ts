import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import {
  CHANGES_ITEM_CAP,
  CHANGE_TITLE_MAX_CHARS,
} from '../../domain/constants/investigation.constants';
import { clip } from '../../domain/policies/answer-sanitizer.policy';
import { formatKyivDateTime } from '../../domain/policies/kyiv-time.policy';
import { isReleasePullRequest } from '../../domain/policies/release-pull-request.policy';
import { parseWindow } from '../../domain/policies/metric-params.policy';
import {
  RECENT_CHANGES_PORT,
  type RecentChangesPort,
} from '../../domain/ports/recent-changes.port';

import type { RecentChangesInput } from './investigation-executors';

const MS_PER_HOUR = 3_600_000;
const DEFAULT_CHANGES_WINDOW = '24h';

@Injectable()
export class RecentChangesExecutor {
  constructor(
    @Inject(RECENT_CHANGES_PORT) private readonly changes: RecentChangesPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async run(input: RecentChangesInput): Promise<unknown> {
    const window = parseWindow(input.window ?? DEFAULT_CHANGES_WINDOW);
    if (window === null) {
      throw new Error('window must look like 24h or 7d and be at most 7 days');
    }
    const report = await this.changes.since(this.clock.nowMs() - window.hours * MS_PER_HOUR);
    return {
      window: window.promql,
      pullRequests: report.mergedPullRequests.slice(0, CHANGES_ITEM_CAP).map((pullRequest) => ({
        number: pullRequest.number,
        title: clip(pullRequest.title, CHANGE_TITLE_MAX_CHARS),
        into: pullRequest.baseBranch,
        isRelease: isReleasePullRequest(pullRequest),
        mergedAtKyiv: formatKyivDateTime(pullRequest.mergedAtMs),
      })),
      deployments: report.deployments.slice(0, CHANGES_ITEM_CAP).map((deployment) => ({
        environment: deployment.environment,
        state: deployment.state,
        atKyiv: formatKyivDateTime(deployment.atMs),
      })),
    };
  }
}
