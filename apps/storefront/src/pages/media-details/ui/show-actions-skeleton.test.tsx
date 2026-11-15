import { render } from '@testing-library/react';
import type { TrackingState } from '@/entities/episode';
import { ShowActionsSkeleton } from './show-actions-skeleton';

function skeletonCount(state: TrackingState): number {
  const { container } = render(<ShowActionsSkeleton state={state} />);
  return container.querySelectorAll('.skeleton').length;
}

describe('ShowActionsSkeleton', () => {
  it('draws a different shape for each tracking state', () => {
    const counts = (['guest', 'start', 'watching', 'watching-next'] as const).map(skeletonCount);
    expect(new Set(counts).size).toBe(4);
  });

  it('adds the next-episode line only when an episode is coming', () => {
    expect(skeletonCount('watching-next')).toBe(skeletonCount('watching') + 1);
  });
});
