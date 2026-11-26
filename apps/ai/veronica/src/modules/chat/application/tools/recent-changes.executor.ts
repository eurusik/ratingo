import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, RowList, type ClockPort, type RowOmission } from '@ratingo/ai-core';

import { RELEASE_BASE_BRANCH, RELEASE_HEAD_BRANCH } from '../../domain/constants/happy.constants';
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
const SHORTER_WINDOW_HINT = 'pass a shorter window';
const SHORTER_WINDOW_OR_BRANCH_HINT = `${SHORTER_WINDOW_HINT} or into=${RELEASE_HEAD_BRANCH} or into=${RELEASE_BASE_BRANCH}`;

const pullRequestsHintFor = (into: string | undefined): string =>
  into === undefined ? SHORTER_WINDOW_OR_BRANCH_HINT : SHORTER_WINDOW_HINT;

const pullRequestsOmission = (omission: RowOmission | undefined) =>
  omission === undefined
    ? {}
    : { pullRequestsOmitted: omission.omitted, pullRequestsHint: omission.hint };

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
    const pullRequests = report.mergedPullRequests
      .filter((pullRequest) => input.into === undefined || pullRequest.baseBranch === input.into)
      .map((pullRequest) => ({
        number: pullRequest.number,
        title: clip(pullRequest.title, CHANGE_TITLE_MAX_CHARS),
        into: pullRequest.baseBranch,
        isRelease: isReleasePullRequest(pullRequest),
        mergedAtKyiv: formatKyivDateTime(pullRequest.mergedAtMs),
      }));
    const deployments = report.deployments.slice(0, CHANGES_ITEM_CAP).map((deployment) => ({
      environment: deployment.environment,
      state: deployment.state,
      atKyiv: formatKyivDateTime(deployment.atMs),
    }));
    const deploymentsOmitted = report.deployments.length - deployments.length;
    return RowList.of(pullRequests, pullRequestsHintFor(input.into), (kept, omission) => ({
      window: window.promql,
      pullRequests: kept,
      ...pullRequestsOmission(omission),
      deployments,
      ...(deploymentsOmitted > 0 ? { deploymentsOmitted } : {}),
    }));
  }
}
