import type { FxMode } from '../../types';

const AUDIO_REFERENCE_MS = 4729;

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
}

export function buildAchievementTimeline(input: TimelineInput): AchievementTimeline {
  const isLite = input.mode === 'lite' || input.reducedMotion;
  const useAudioTimeline = input.hasExternalDuration && input.durationMs > 1800;
  const audioScale = input.durationMs / AUDIO_REFERENCE_MS;
  const fromAudio = (ms: number): number => Math.round(ms * audioScale);

  const attackEndMs = useAudioTimeline ? fromAudio(760) : Math.min(180, input.durationMs * 0.16);
  const settleStartMs = useAudioTimeline ? fromAudio(520) : input.durationMs * 0.09;
  const settleDurationMs = useAudioTimeline ? fromAudio(340) : Math.min(300, input.durationMs * 0.2);
  const sweepStartMs = useAudioTimeline ? fromAudio(560) : input.durationMs * 0.15;
  const sweepDurationMs = useAudioTimeline ? fromAudio(460) : Math.min(320, input.durationMs * 0.24);
  const tailStartMs = useAudioTimeline ? fromAudio(3120) : input.durationMs * 0.7;
  const signalDurationMs = useAudioTimeline
    ? fromAudio(220)
    : Math.min(300, Math.max(180, input.durationMs * 0.2));
  const signalCutStartMs = Math.max(0, input.durationMs - signalDurationMs);
  const fadeDurationMs = useAudioTimeline ? fromAudio(70) : Math.min(110, input.durationMs * 0.075);
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
    secondFlashStartMs: useAudioTimeline ? fromAudio(730) : input.durationMs * 0.25,
    secondFlashEndMs: useAudioTimeline ? fromAudio(980) : input.durationMs * 0.4,
    secondBurstMs: useAudioTimeline ? fromAudio(840) : input.durationMs * 0.24,
    shockStartMs: useAudioTimeline ? fromAudio(510) : input.durationMs * 0.07,
    shockDurationMs: useAudioTimeline ? fromAudio(430) : input.durationMs * 0.18,
    shock2StartMs: useAudioTimeline ? fromAudio(830) : input.durationMs * 0.18,
    shock2DurationMs: useAudioTimeline ? fromAudio(440) : input.durationMs * 0.22,
    preSignalLeadMs: useAudioTimeline ? fromAudio(110) : 90,
  };
}
