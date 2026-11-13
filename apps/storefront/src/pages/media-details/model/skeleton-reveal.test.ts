import { consumeSkeletonShownFor, markSkeletonShownFor } from './skeleton-reveal';

describe('skeleton reveal flag', () => {
  it('is consumed once by the page that showed the skeleton', () => {
    markSkeletonShownFor('/movies/a');

    expect(consumeSkeletonShownFor('/movies/a')).toBe(true);
    expect(consumeSkeletonShownFor('/movies/a')).toBe(false);
  });

  it('does not reveal a different page that loaded without a skeleton', () => {
    markSkeletonShownFor('/movies/a');

    expect(consumeSkeletonShownFor('/movies/b')).toBe(false);
    expect(consumeSkeletonShownFor('/movies/a')).toBe(false);
  });
});
