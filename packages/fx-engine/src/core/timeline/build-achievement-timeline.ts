import type { FxMode } from '../../types';

const AUDIO_REFERENCE_MS = 4729;
const AUDIO_TIMELINE = {
  attackEndMs: 660,
  settleStartMs: 450,
  settleDurationMs: 330,
  sweepStartMs: 480,
  sweepDurationMs: 420,
  tailStartMs: 2460,
  signalDurationMs: 540,
  fadeDurationMs: 90,
  secondFlashStartMs: 640,
  secondFlashEndMs: 980,
  secondBurstMs: 760,
  shockStartMs: 430,
  shockDurationMs: 320,
  shock2StartMs: 790,
  shock2DurationMs: 360,
  preSignalLeadMs: 170,
  textRevealStartMs: 920,
  textRevealDurationMs: 280,
  subtitleRevealLagMs: 90,
} as const;

export interface TimelineInput {
  durationMs: number;
  mode: FxMode;
  reducedMotion: boolean;
  hasExternalDuration: boolean;
}

export interface AchievementTimeline {
  durationMs: number;
  isLite: boolean;
  useAudioTimeline: boolean;
  attackEndMs: number;
  settleStartMs: number;
  settleDurationMs: number;
  sweepStartMs: number;
  sweepDurationMs: number;
  tailStartMs: number;
  signalDurationMs: number;
  signalCutStartMs: number;
  fadeDurationMs: number;
  fadeStartMs: number;
  secondFlashStartMs: number;
  secondFlashEndMs: number;
  secondBurstMs: number;
  shockStartMs: number;
  shockDurationMs: number;
  shock2StartMs: number;
  shock2DurationMs: number;
  preSignalLeadMs: number;
  textRevealStartMs: number;
  textRevealDurationMs: number;
  subtitleRevealLagMs: number;
}

export function buildAchievementTimeline(input: TimelineInput): AchievementTimeline {
  const isLite = input.mode === 'lite' || input.reducedMotion;
  const useAudioTimeline = input.hasExternalDuration && input.durationMs > 1800;
  const audioScale = input.durationMs / AUDIO_REFERENCE_MS;
  const fromAudio = (ms: number): number => Math.round(ms * audioScale);

  const attackEndMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.attackEndMs)
    : Math.min(180, input.durationMs * 0.16);
  const settleStartMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.settleStartMs)
    : input.durationMs * 0.09;
  const settleDurationMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.settleDurationMs)
    : Math.min(300, input.durationMs * 0.2);
  const sweepStartMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.sweepStartMs)
    : input.durationMs * 0.15;
  const sweepDurationMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.sweepDurationMs)
    : Math.min(320, input.durationMs * 0.24);
  const tailStartMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.tailStartMs)
    : input.durationMs * 0.7;
  const signalDurationMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.signalDurationMs)
    : Math.min(300, Math.max(180, input.durationMs * 0.2));
  const signalCutStartMs = Math.max(0, input.durationMs - signalDurationMs);
  const fadeDurationMs = useAudioTimeline
    ? fromAudio(AUDIO_TIMELINE.fadeDurationMs)
    : Math.min(110, input.durationMs * 0.075);
  const fadeStartMs = Math.max(0, input.durationMs - fadeDurationMs);

  return {
    durationMs: input.durationMs,
    isLite,
    useAudioTimeline,
    attackEndMs,
    settleStartMs,
    settleDurationMs,
    sweepStartMs,
    sweepDurationMs,
    tailStartMs,
    signalDurationMs,
    signalCutStartMs,
    fadeDurationMs,
    fadeStartMs,
    secondFlashStartMs: useAudioTimeline
      ? fromAudio(AUDIO_TIMELINE.secondFlashStartMs)
      : input.durationMs * 0.25,
    secondFlashEndMs: useAudioTimeline
      ? fromAudio(AUDIO_TIMELINE.secondFlashEndMs)
      : input.durationMs * 0.4,
    secondBurstMs: useAudioTimeline
      ? fromAudio(AUDIO_TIMELINE.secondBurstMs)
      : input.durationMs * 0.24,
    shockStartMs: useAudioTimeline ? fromAudio(AUDIO_TIMELINE.shockStartMs) : input.durationMs * 0.07,
    shockDurationMs: useAudioTimeline
      ? fromAudio(AUDIO_TIMELINE.shockDurationMs)
      : input.durationMs * 0.18,
    shock2StartMs: useAudioTimeline
      ? fromAudio(AUDIO_TIMELINE.shock2StartMs)
      : input.durationMs * 0.18,
    shock2DurationMs: useAudioTimeline
      ? fromAudio(AUDIO_TIMELINE.shock2DurationMs)
      : input.durationMs * 0.22,
    preSignalLeadMs: useAudioTimeline ? fromAudio(AUDIO_TIMELINE.preSignalLeadMs) : 90,
    textRevealStartMs: useAudioTimeline ? fromAudio(AUDIO_TIMELINE.textRevealStartMs) : input.durationMs * 0.24,
    textRevealDurationMs: useAudioTimeline
      ? fromAudio(AUDIO_TIMELINE.textRevealDurationMs)
      : Math.min(320, input.durationMs * 0.26),
    subtitleRevealLagMs: useAudioTimeline ? fromAudio(AUDIO_TIMELINE.subtitleRevealLagMs) : 80,
  };
}
