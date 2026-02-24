import type { Graphics } from 'pixi.js';
import { hash01, impactSpike, lerp } from '../../../core/math/scalars';
import type { SignalState } from '../../../core/timeline/compute-signal-state';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SignalGlitchPluginConfig {
  scanline: Graphics;
  noiseDots: Graphics;
  glitchBands: Graphics;
  interferenceStrips: Graphics;
  signalStatic: Graphics;
  cutPulse: Graphics;
  bounds: Bounds;
  signalCutStartMs: number;
}

interface SignalGlitchFrameState {
  elapsedMs: number;
  fadeOutT: number;
  signalState: SignalState;
}

export class SignalGlitchPlugin {
  constructor(private readonly config: SignalGlitchPluginConfig) {}

  update(frame: SignalGlitchFrameState): void {
    this.updateNoise(frame);
    this.updateInterference(frame);
    this.updateStatic(frame);
    this.updateGlitchBands(frame);

    const blackoutA = impactSpike(frame.signalState.signalCutT, 0.54, 0.72);
    const blackoutB = impactSpike(frame.signalState.signalCutT, 0.78, 1);
    this.config.cutPulse.alpha = Math.max(blackoutA * 0.85, blackoutB);
  }

  private updateNoise(frame: SignalGlitchFrameState): void {
    const { signalState, elapsedMs, fadeOutT } = frame;
    this.config.scanline.alpha =
      (signalState.signalNoiseFloor * 1.15 + signalState.signalStrength * 0.64) * (1 - fadeOutT);
    this.config.noiseDots.alpha =
      (signalState.signalNoiseFloor * 1.1 + signalState.signalStrength * 0.56) * (1 - fadeOutT);

    if (signalState.inSignalCut) {
      const roll = elapsedMs - this.config.signalCutStartMs;
      this.config.scanline.y = ((roll * 0.95) % 7) - 3.5;
      this.config.noiseDots.x = Math.sin(roll * 1.4) * 3.2;
      return;
    }

    this.config.scanline.y = 0;
    this.config.noiseDots.x = 0;
  }

  private updateInterference(frame: SignalGlitchFrameState): void {
    this.config.interferenceStrips.clear();
    this.config.interferenceStrips.alpha = 0;
    if (frame.signalState.signalStrength <= 0.03 && frame.signalState.preSignalT <= 0.2) return;

    const stripFrame = Math.floor((frame.elapsedMs - this.config.signalCutStartMs) / 7);
    const stripCount = Math.max(
      12,
      Math.round(14 + frame.signalState.signalStrength * 26 + frame.signalState.preSignalT * 14),
    );

    const { x, y, width, height } = this.config.bounds;
    const primeY = y + (0.18 + hash01(stripFrame * 17 + 3) * 0.64) * height;
    const primeH = lerp(8, 22, hash01(stripFrame * 17 + 4));
    const primeShift = lerp(-30, 30, hash01(stripFrame * 17 + 5));

    this.config.interferenceStrips.beginFill(0xffffff, 0.52 + frame.signalState.signalStrength * 0.2);
    this.config.interferenceStrips.drawRect(x + primeShift, primeY, width, primeH);
    this.config.interferenceStrips.endFill();

    this.config.interferenceStrips.beginFill(0x000000, 0.38 + frame.signalState.signalStrength * 0.16);
    this.config.interferenceStrips.drawRect(x - primeShift * 0.6, primeY + primeH * 0.55, width, primeH * 0.5);
    this.config.interferenceStrips.endFill();

    for (let i = 0; i < stripCount; i++) {
      const seed = stripFrame * 211 + i * 31;
      const stripY = y + hash01(seed + 1) * height;
      const stripH = lerp(1.1, 6.2, hash01(seed + 2));
      const stripW = lerp(width * 0.55, width, hash01(seed + 3));
      const direction = hash01(seed + 4) > 0.5 ? 1 : -1;
      const jitterX = direction * lerp(6, 34, hash01(seed + 5));
      const stripX = x + (width - stripW) / 2 + jitterX;
      const colorPick = hash01(seed + 6);
      const color =
        colorPick > 0.82 ? 0xffffff : colorPick > 0.63 ? 0xa7d4ff : colorPick > 0.44 ? 0xffe4b8 : 0x000000;
      const alpha =
        lerp(0.2, 0.58, hash01(seed + 7)) * (0.45 + frame.signalState.signalStrength * 0.95);

      this.config.interferenceStrips.beginFill(color, alpha);
      this.config.interferenceStrips.drawRect(stripX, stripY, stripW, stripH);
      this.config.interferenceStrips.endFill();
    }

    this.config.interferenceStrips.alpha =
      Math.min(1, 0.56 + frame.signalState.signalStrength * 0.95 + frame.signalState.preSignalT * 0.3) *
      (1 - frame.fadeOutT * 0.1);
  }

  private updateStatic(frame: SignalGlitchFrameState): void {
    this.config.signalStatic.clear();
    this.config.signalStatic.alpha = 0;
    if (frame.signalState.signalStrength <= 0.03 && frame.signalState.preSignalT <= 0.35) return;

    const staticFrame = Math.floor((frame.elapsedMs - this.config.signalCutStartMs) / 7);
    const preBoost = frame.signalState.preSignalT > 0 ? frame.signalState.preSignalT * 26 : 0;
    const staticCount = Math.max(
      90,
      Math.round(110 + frame.signalState.signalStrength * 220 + preBoost),
    );
    const { x, y, width, height } = this.config.bounds;

    for (let i = 0; i < staticCount; i++) {
      const seed = staticFrame * 131 + i * 17;
      const stripe = hash01(seed + 1) > 0.58;
      const pointX = x + hash01(seed + 2) * width;
      const pointY = y + hash01(seed + 3) * height;
      const pointW = stripe ? lerp(width * 0.25, width * 0.98, hash01(seed + 4)) : lerp(1.2, 9.5, hash01(seed + 4));
      const pointH = stripe ? lerp(1.2, 5.6, hash01(seed + 5)) : lerp(0.9, 2.8, hash01(seed + 5));
      const colorRoll = hash01(seed + 6);
      const color =
        colorRoll > 0.86 ? 0xffffff : colorRoll > 0.68 ? 0xa7d4ff : colorRoll > 0.48 ? 0x000000 : 0xffdca8;
      const alpha =
        lerp(0.28, 0.82, hash01(seed + 7)) * (0.58 + frame.signalState.signalStrength * 0.78);

      this.config.signalStatic.beginFill(color, alpha);
      this.config.signalStatic.drawRect(pointX, pointY, Math.min(pointW, width), pointH);
      this.config.signalStatic.endFill();
    }

    this.config.signalStatic.alpha =
      Math.min(1, 0.54 + frame.signalState.signalStrength * 0.98 + frame.signalState.preSignalT * 0.18) *
      (1 - frame.fadeOutT * 0.16) *
      (1 - frame.signalState.disappearEase * 0.15);

    if (!frame.signalState.inSignalCut) {
      this.config.signalStatic.alpha += frame.signalState.preSignalT * 0.18;
    }
  }

  private updateGlitchBands(frame: SignalGlitchFrameState): void {
    this.config.glitchBands.alpha = frame.signalState.signalStrength * (1 - frame.fadeOutT * 0.12);
    this.config.glitchBands.clear();
    if (frame.signalState.signalStrength <= 0.03) return;

    const { x, y, width, height } = this.config.bounds;
    const glitchFrame = Math.floor((frame.elapsedMs - this.config.signalCutStartMs) / 8);
    const bandCount = Math.max(2, Math.round(3 + frame.signalState.signalStrength * 6));
    const majorSeed = glitchFrame * 53 + 7;
    const majorBandY = y + hash01(majorSeed + 1) * height;
    const majorBandH = lerp(6, 18, hash01(majorSeed + 2));
    const majorBandX = x + lerp(-18, 18, hash01(majorSeed + 3));
    const majorBandAlpha = 0.16 + frame.signalState.signalStrength * 0.22;
    const majorBandColor = hash01(majorSeed + 4) > 0.5 ? 0xffffff : 0xa7d4ff;

    this.config.glitchBands.beginFill(majorBandColor, majorBandAlpha);
    this.config.glitchBands.drawRect(majorBandX, majorBandY, width, majorBandH);
    this.config.glitchBands.endFill();

    for (let i = 0; i < bandCount; i++) {
      const seed = glitchFrame * 37 + i * 19;
      const bandY = y + hash01(seed + 1) * height;
      const bandH = lerp(3, 8.5, hash01(seed + 2));
      const bandW = lerp(width * 0.62, width * 0.98, hash01(seed + 3));
      const bandX =
        x +
        (width - bandW) / 2 +
        frame.signalState.signalKickX * lerp(0.18, 0.86, hash01(seed + 4)) +
        lerp(-6, 6, hash01(seed + 5));
      const alpha =
        lerp(0.08, 0.24, hash01(seed + 6)) * (0.42 + frame.signalState.signalStrength * 0.82);
      const color = hash01(seed + 7) > 0.66 ? 0xa7d4ff : 0xffffff;

      this.config.glitchBands.beginFill(color, alpha);
      this.config.glitchBands.drawRect(bandX, bandY, bandW, bandH);
      this.config.glitchBands.endFill();
    }
  }
}
