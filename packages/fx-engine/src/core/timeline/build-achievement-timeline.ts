import type { FxMode, FxRarity } from '../../types';

const AUDIO_REFERENCE_MS = 4729;
const AUDIO_TIMELINE_BY_RARITY: Record<
  FxRarity,
  {
    attackEndMs: number;
    settleStartMs: number;
    settleDurationMs: number;
    sweepStartMs: number;
    sweepDurationMs: number;
    tailStartMs: number;
    signalDurationMs: number;
    fadeDurationMs: number;
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
> = {
  common: {
    attackEndMs: 620,
    settleStartMs: 420,
    settleDurationMs: 280,
    sweepStartMs: 440,
    sweepDurationMs: 300,
    tailStartMs: 4140,
    signalDurationMs: 500,
    fadeDurationMs: 90,
    secondFlashStartMs: 560,
    secondFlashEndMs: 760,
    secondBurstMs: 700,
    shockStartMs: 380,
    shockDurationMs: 220,
    shock2StartMs: 700,
    shock2DurationMs: 220,
    preSignalLeadMs: 150,
    textRevealStartMs: 760,
    textRevealDurationMs: 220,
    subtitleRevealLagMs: 70,
  },
  rare: {
    attackEndMs: 650,
    settleStartMs: 440,
    settleDurationMs: 300,
    sweepStartMs: 470,
    sweepDurationMs: 340,
    tailStartMs: 4000,
    signalDurationMs: 520,
    fadeDurationMs: 96,
    secondFlashStartMs: 610,
    secondFlashEndMs: 860,
    secondBurstMs: 740,
    shockStartMs: 410,
    shockDurationMs: 260,
    shock2StartMs: 760,
    shock2DurationMs: 280,
    preSignalLeadMs: 160,
    textRevealStartMs: 860,
    textRevealDurationMs: 250,
    subtitleRevealLagMs: 80,
  },
  epic: {
    attackEndMs: 700,
    settleStartMs: 490,
    settleDurationMs: 320,
    sweepStartMs: 520,
    sweepDurationMs: 380,
    tailStartMs: 3840,
    signalDurationMs: 540,
    fadeDurationMs: 100,
    secondFlashStartMs: 660,
    secondFlashEndMs: 940,
    secondBurstMs: 780,
    shockStartMs: 430,
    shockDurationMs: 300,
    shock2StartMs: 790,
    shock2DurationMs: 320,
    preSignalLeadMs: 170,
    textRevealStartMs: 980,
    textRevealDurationMs: 290,
    subtitleRevealLagMs: 90,
  },
  legendary: {
    attackEndMs: 760,
    settleStartMs: 520,
    settleDurationMs: 340,
    sweepStartMs: 560,
    sweepDurationMs: 420,
    tailStartMs: 3520,
    signalDurationMs: 560,
    fadeDurationMs: 120,
    secondFlashStartMs: 760,
    secondFlashEndMs: 1080,
    secondBurstMs: 860,
    shockStartMs: 510,
    shockDurationMs: 340,
    shock2StartMs: 860,
    shock2DurationMs: 380,
    preSignalLeadMs: 170,
    textRevealStartMs: 1160,
    textRevealDurationMs: 320,
    subtitleRevealLagMs: 100,
  },
} as const;

export interface TimelineInput {
  durationMs: number;
  mode: FxMode;
  rarity: FxRarity;
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
  const audioTemplate = AUDIO_TIMELINE_BY_RARITY[input.rarity];
  const audioScale = input.durationMs / AUDIO_REFERENCE_MS;
  const fromAudio = (ms: number): number => Math.round(ms * audioScale);

  const attackEndMs = useAudioTimeline
    ? fromAudio(audioTemplate.attackEndMs)
    : Math.min(180, input.durationMs * 0.16);
  const settleStartMs = useAudioTimeline
    ? fromAudio(audioTemplate.settleStartMs)
    : input.durationMs * 0.09;
  const settleDurationMs = useAudioTimeline
    ? fromAudio(audioTemplate.settleDurationMs)
    : Math.min(300, input.durationMs * 0.2);
  const sweepStartMs = useAudioTimeline
    ? fromAudio(audioTemplate.sweepStartMs)
    : input.durationMs * 0.15;
  const sweepDurationMs = useAudioTimeline
    ? fromAudio(audioTemplate.sweepDurationMs)
    : Math.min(320, input.durationMs * 0.24);
  const tailStartMs = useAudioTimeline
    ? fromAudio(audioTemplate.tailStartMs)
    : input.durationMs * 0.7;
  const signalDurationMs = useAudioTimeline
    ? fromAudio(audioTemplate.signalDurationMs)
    : Math.min(300, Math.max(180, input.durationMs * 0.2));
  const signalCutStartMs = Math.max(0, input.durationMs - signalDurationMs);
  const fadeDurationMs = useAudioTimeline
    ? fromAudio(audioTemplate.fadeDurationMs)
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
      ? fromAudio(audioTemplate.secondFlashStartMs)
      : input.durationMs * 0.25,
    secondFlashEndMs: useAudioTimeline
      ? fromAudio(audioTemplate.secondFlashEndMs)
      : input.durationMs * 0.4,
    secondBurstMs: useAudioTimeline
      ? fromAudio(audioTemplate.secondBurstMs)
      : input.durationMs * 0.24,
    shockStartMs: useAudioTimeline ? fromAudio(audioTemplate.shockStartMs) : input.durationMs * 0.07,
    shockDurationMs: useAudioTimeline
      ? fromAudio(audioTemplate.shockDurationMs)
      : input.durationMs * 0.18,
    shock2StartMs: useAudioTimeline
      ? fromAudio(audioTemplate.shock2StartMs)
      : input.durationMs * 0.18,
    shock2DurationMs: useAudioTimeline
      ? fromAudio(audioTemplate.shock2DurationMs)
      : input.durationMs * 0.22,
    preSignalLeadMs: useAudioTimeline ? fromAudio(audioTemplate.preSignalLeadMs) : 90,
    textRevealStartMs: useAudioTimeline ? fromAudio(audioTemplate.textRevealStartMs) : input.durationMs * 0.24,
    textRevealDurationMs: useAudioTimeline
      ? fromAudio(audioTemplate.textRevealDurationMs)
      : Math.min(320, input.durationMs * 0.26),
    subtitleRevealLagMs: useAudioTimeline ? fromAudio(audioTemplate.subtitleRevealLagMs) : 80,
  };
}
