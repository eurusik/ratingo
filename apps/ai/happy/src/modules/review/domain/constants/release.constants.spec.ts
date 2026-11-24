import { RELEASE_BASE_BRANCH, RELEASE_HEAD_BRANCH } from './release.constants';

describe('release branches', () => {
  it('match the values Veronica uses to recognise a release (apps/ai/ARCHITECTURE.md)', () => {
    expect([RELEASE_HEAD_BRANCH, RELEASE_BASE_BRANCH]).toEqual(['development', 'main']);
  });
});
