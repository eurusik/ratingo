import type { CheckReport } from '../entities/check-report';
import type { PullRequestRef } from '../entities/pull-request';

export const CHECK_RUN_PUBLISHER_PORT = Symbol('CHECK_RUN_PUBLISHER_PORT');

export const CHECK_RUN_NAME = 'Happy';

export interface CheckRunPublisherPort {
  publish(ref: PullRequestRef, headSha: string, report: CheckReport): Promise<void>;
}
