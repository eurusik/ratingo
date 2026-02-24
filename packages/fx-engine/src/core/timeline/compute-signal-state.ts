import { easeOutCubic } from '../math/easing';
import { clamp, impactSpike } from '../math/scalars';

export interface SignalStateInput {
  elapsedMs: number;
  signalCutStartMs: number;
  signalDurationMs: number;
  preSignalLeadMs: number;
}

export interface SignalState {
  signalCutT: number;
  preSignalT: number;
  inSignalCut: boolean;
  signalSpikeA: number;
  signalSpikeB: number;
  signalSpikeC: number;
  signalSpikeD: number;
  signalStrength: number;
  disappearEase: number;
  signalRush: number;
  signalNoiseFloor: number;
  signalKickX: number;
}

export function computeSignalState(input: SignalStateInput): SignalState {
  const signalCutT = clamp((input.elapsedMs - input.signalCutStartMs) / input.signalDurationMs, 0, 1);
  const preSignalT = clamp(
    (input.elapsedMs - (input.signalCutStartMs - input.preSignalLeadMs)) / input.preSignalLeadMs,
    0,
    1,
  );
  const inSignalCut = signalCutT > 0.01;

  const signalSpikeA = impactSpike(signalCutT, 0.02, 0.1);
  const signalSpikeB = impactSpike(signalCutT, 0.14, 0.28);
  const signalSpikeC = impactSpike(signalCutT, 0.34, 0.52);
  const signalSpikeD = impactSpike(signalCutT, 0.62, 0.82);

  const signalBase = inSignalCut ? 0.08 * (1 - signalCutT * 0.65) : 0;
  const signalStrength = clamp(
    Math.max(
      signalSpikeA * 0.9,
      signalSpikeB * 1.02,
      signalSpikeC * 1.08,
      signalSpikeD * 1.5,
    ) + signalBase,
    0,
    1.6,
  );

  const disappearT = clamp((signalCutT - 0.7) / 0.3, 0, 1);
  const disappearEase = easeOutCubic(disappearT);
  const signalRush = inSignalCut
    ? Math.sin((input.elapsedMs - input.signalCutStartMs) * 0.55) * 0.5 + 0.5
    : 0;
  const signalNoiseFloor = inSignalCut ? 0.11 + signalRush * 0.05 : 0.018 + preSignalT * 0.045;
  const signalKickX =
    -6.5 * signalSpikeA + 5.2 * signalSpikeB - 3.8 * signalSpikeC + 2.7 * signalSpikeD;

  return {
    signalCutT,
    preSignalT,
    inSignalCut,
    signalSpikeA,
    signalSpikeB,
    signalSpikeC,
    signalSpikeD,
    signalStrength,
    disappearEase,
    signalRush,
    signalNoiseFloor,
    signalKickX,
  };
}
