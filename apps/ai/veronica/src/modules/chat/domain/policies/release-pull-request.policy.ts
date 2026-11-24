import { RELEASE_BASE_BRANCH, RELEASE_HEAD_BRANCH } from '../constants/happy.constants';

export const isReleasePullRequest = (pull: { baseBranch: string; headBranch: string }): boolean =>
  pull.baseBranch === RELEASE_BASE_BRANCH && pull.headBranch === RELEASE_HEAD_BRANCH;
