import { describe, expect, it } from '@jest/globals';
import { buildAchievementTimeline } from '../src/core/timeline/build-achievement-timeline';
import { computeSignalState } from '../src/core/timeline/compute-signal-state';

describe('buildAchievementTimeline', () => {
  it('uses compact timeline for short internal durations', () => {
    const timeline = buildAchievementTimeline({
      durationMs: 1200,
      mode: 'epic',
      reducedMotion: false,
      hasExternalDuration: false,
    });

    expect(timeline.useAudioTimeline).toBe(false);
    expect(timeline.isLite).toBe(false);
    expect(timeline.fadeStartMs).toBeGreaterThan(0);
    expect(timeline.fadeStartMs).toBeLessThanOrEqual(timeline.durationMs);
  });

  it('scales key points against external audio duration', () => {
    const timeline = buildAchievementTimeline({
      durationMs: 4729,
      mode: 'epic',
      reducedMotion: false,
      hasExternalDuration: true,
    });

    expect(timeline.useAudioTimeline).toBe(true);
    expect(timeline.attackEndMs).toBe(760);
    expect(timeline.signalDurationMs).toBe(220);
    expect(timeline.fadeDurationMs).toBe(70);
    expect(timeline.signalCutStartMs).toBe(timeline.durationMs - timeline.signalDurationMs);
  });

  it('forces lite behavior for lite mode or reduced motion', () => {
    const liteMode = buildAchievementTimeline({
      durationMs: 1400,
      mode: 'lite',
      reducedMotion: false,
      hasExternalDuration: false,
    });
    const reduced = buildAchievementTimeline({
      durationMs: 1400,
      mode: 'epic',
      reducedMotion: true,
      hasExternalDuration: false,
    });

    expect(liteMode.isLite).toBe(true);
    expect(reduced.isLite).toBe(true);
  });
});

describe('computeSignalState', () => {
  it('returns pre-signal state before cut start', () => {
    const state = computeSignalState({
      elapsedMs: 900,
      signalCutStartMs: 1_000,
      signalDurationMs: 200,
      preSignalLeadMs: 100,
    });

    expect(state.inSignalCut).toBe(false);
    expect(state.signalCutT).toBe(0);
    expect(state.preSignalT).toBe(0);
    expect(state.signalNoiseFloor).toBeGreaterThan(0);
  });

  it('computes active glitch state during signal cut', () => {
    const state = computeSignalState({
      elapsedMs: 1_120,
      signalCutStartMs: 1_000,
      signalDurationMs: 200,
      preSignalLeadMs: 100,
    });

    expect(state.inSignalCut).toBe(true);
    expect(state.signalCutT).toBeCloseTo(0.6);
    expect(state.signalStrength).toBeGreaterThan(0);
  });
});
