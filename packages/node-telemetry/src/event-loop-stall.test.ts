import { EVENT_LOOP_RESOLUTION_MS, toStallSeconds } from './event-loop-stall';

const NS_PER_MS = 1e6;

describe('toStallSeconds', () => {
  it('reports an idle loop sampled at the resolution as no stall', () => {
    expect(toStallSeconds(EVENT_LOOP_RESOLUTION_MS * NS_PER_MS)).toBe(0);
  });

  it('clamps delays below the resolution at zero', () => {
    expect(toStallSeconds(19.7 * NS_PER_MS)).toBe(0);
  });

  it('subtracts the resolution from longer delays', () => {
    expect(toStallSeconds(520 * NS_PER_MS)).toBeCloseTo(0.5, 9);
  });
});
