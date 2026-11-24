import { RELEASE_BASE_BRANCH, RELEASE_HEAD_BRANCH } from './happy.constants';

describe('release branches', () => {
  it('match the values Happy uses to build a release checklist (apps/ai/ARCHITECTURE.md)', () => {
    expect([RELEASE_HEAD_BRANCH, RELEASE_BASE_BRANCH]).toEqual(['development', 'main']);
  });
});
