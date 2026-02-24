import { Application, Container } from 'pixi.js';
import { RARITY_VISUAL } from '../../../core/config/rarity-profile';
import { easeInOutCubic, easeOutCubic } from '../../../core/math/easing';
import { clamp, lerp } from '../../../core/math/scalars';
import { computeSignalState } from '../../../core/timeline/compute-signal-state';
import { buildAchievementTimeline } from '../../../core/timeline/build-achievement-timeline';
import type { FxEvent, FxRenderOptions } from '../../../types';
import { ParticlesPlugin } from '../plugins/particles-plugin';
import { SignalGlitchPlugin } from '../plugins/signal-glitch-plugin';
import { createAchievementCard } from '../scene/create-achievement-card';
import { createAchievementMask } from '../scene/create-achievement-mask';
import { createBackdropLayers } from '../scene/create-backdrop-layers';

export async function playAchievementUnlockedScene(
  app: Application,
  event: FxEvent,
  options: FxRenderOptions,
): Promise<void> {
  const rarity = event.rarity ?? 'common';
  const profile = RARITY_VISUAL[rarity];
  const externalDurationMs = options.durationMs && options.durationMs > 0 ? options.durationMs : null;
  const timeline = buildAchievementTimeline({
    durationMs: Math.round(externalDurationMs ?? profile.durationMs),
    mode: options.mode,
    reducedMotion: options.reducedMotion,
    hasExternalDuration: externalDurationMs !== null,
  });

  const isLite = timeline.isLite;
  const liteFactor = isLite ? 0.55 : 1;
  const durationMs = timeline.durationMs;
  const flashAlpha = profile.flashAlpha * liteFactor;
  const vignetteTarget = profile.vignette * (isLite ? 0.5 : 1);
  const sparkCount = Math.max(2, Math.round(profile.sparkCount * liteFactor));
  const debrisCount = Math.max(1, Math.round(profile.debrisCount * liteFactor));
  const smokeCount = Math.max(2, Math.round(profile.smokeCount * liteFactor));
  const shockwaveEnabled = profile.shockwave && options.mode === 'epic' && !isLite;
  const shakePx = profile.shakePx * liteFactor;
  const cameraPunch = profile.cameraPunch * liteFactor;

  const width = app.screen.width;
  const height = app.screen.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const medalY = centerY - Math.min(64, height * 0.08);
  const glitchBlockWidth = Math.min(width * 0.7, 900);
  const glitchBlockHeight = Math.min(height * 0.5, 420);
  const glitchBlockX = centerX - glitchBlockWidth / 2;
  const glitchBlockY = medalY - Math.min(170, height * 0.24);

  const root = new Container();
  app.stage.addChild(root);

  const cameraRig = new Container();
  root.addChild(cameraRig);

  const layers = createBackdropLayers({
    root,
    cameraRig,
    profile,
    rarity,
    shockwaveEnabled,
    width,
    height,
    centerX,
    medalY,
  });

  const card = createAchievementCard({
    cameraRig,
    event,
    profile,
    rarity,
    centerX,
    medalY,
  });

  const achievementMask = createAchievementMask({
    cameraRig,
    centerX,
    medalY,
    card,
    maskTargets: [
      layers.scanline,
      layers.noiseDots,
      layers.glitchBands,
      layers.interferenceStrips,
      layers.signalStatic,
      layers.cutPulse,
    ],
  });

  const particlesPlugin = new ParticlesPlugin({
    cameraRig,
    smokeContainer: layers.smokeContainer,
    centerX,
    medalY,
    rarity,
    profile,
    liteFactor,
    sparkCount,
    debrisCount,
    smokeCount,
    secondBurstMs: timeline.secondBurstMs,
    shockStartMs: timeline.shockStartMs,
    durationMs,
  });

  const signalGlitchPlugin = new SignalGlitchPlugin({
    scanline: layers.scanline,
    noiseDots: layers.noiseDots,
    glitchBands: layers.glitchBands,
    interferenceStrips: layers.interferenceStrips,
    signalStatic: layers.signalStatic,
    cutPulse: layers.cutPulse,
    bounds: {
      x: glitchBlockX,
      y: glitchBlockY,
      width: glitchBlockWidth,
      height: glitchBlockHeight,
    },
    signalCutStartMs: timeline.signalCutStartMs,
  });

  const start = performance.now();
  let lastFrame = start;

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      const now = performance.now();
      const deltaFrames = Math.min(2.5, (now - lastFrame) / 16.6667);
      lastFrame = now;
      const t = clamp(elapsed / durationMs, 0, 1);

      const revealT = clamp(elapsed / timeline.attackEndMs, 0, 1);
      const settleT = clamp((elapsed - timeline.settleStartMs) / timeline.settleDurationMs, 0, 1);
      const sweepT = clamp((elapsed - timeline.sweepStartMs) / timeline.sweepDurationMs, 0, 1);
      const textRevealT = clamp(
        (elapsed - timeline.textRevealStartMs) / timeline.textRevealDurationMs,
        0,
        1,
      );
      const subtitleRevealT = clamp(
        (elapsed - (timeline.textRevealStartMs + timeline.subtitleRevealLagMs)) /
          timeline.textRevealDurationMs,
        0,
        1,
      );
      const fadeOutT = clamp((elapsed - timeline.fadeStartMs) / timeline.fadeDurationMs, 0, 1);
      const tailFadeT = clamp(
        (elapsed - timeline.tailStartMs) / Math.max(1, durationMs - timeline.tailStartMs),
        0,
        1,
      );

      const signalState = computeSignalState({
        elapsedMs: elapsed,
        signalCutStartMs: timeline.signalCutStartMs,
        signalDurationMs: timeline.signalDurationMs,
        preSignalLeadMs: timeline.preSignalLeadMs,
      });

      layers.tint.alpha =
        lerp(0, rarity === 'legendary' ? 0.12 : rarity === 'epic' ? 0.1 : 0.04, revealT) *
        (1 - fadeOutT);
      layers.tint.alpha +=
        signalState.inSignalCut ? signalState.signalStrength * (0.02 + signalState.signalRush * 0.03) : 0;

      layers.vignette.alpha = lerp(0, vignetteTarget, easeOutCubic(revealT)) * (1 - fadeOutT);
      layers.flash.alpha =
        flashAlpha *
        (1 - easeOutCubic(clamp(elapsed / Math.max(120, timeline.attackEndMs * 0.85), 0, 1))) *
        (1 - fadeOutT);

      if (
        profile.doubleBurst &&
        elapsed > timeline.secondFlashStartMs &&
        elapsed < timeline.secondFlashEndMs
      ) {
        layers.flash.alpha +=
          0.08 *
          Math.sin(
            ((elapsed - timeline.secondFlashStartMs) /
              (timeline.secondFlashEndMs - timeline.secondFlashStartMs)) *
              Math.PI,
          );
      }

      card.medalRoot.alpha =
        lerp(0, 1, easeOutCubic(revealT)) *
        (1 - fadeOutT) *
        (1 - tailFadeT * 0.24) *
        (1 - signalState.disappearEase);

      const baseScale =
        settleT > 0
          ? lerp(profile.settleScale, 1, easeOutCubic(settleT))
          : lerp(0.62, profile.settleScale, revealT);
      const tearScaleX = 1 + signalState.signalStrength * 0.011;
      card.medalRoot.scale.set(baseScale * tearScaleX, baseScale);
      card.medalRoot.y = lerp(medalY + profile.entryOffsetY, medalY, easeOutCubic(revealT));
      card.medalRoot.x =
        centerX +
        Math.sin(elapsed / 45) * shakePx * (1 - revealT) * (1 - fadeOutT) +
        signalState.signalKickX;

      achievementMask.x = card.medalRoot.x;
      achievementMask.y = card.medalRoot.y;
      achievementMask.scale.set(card.medalRoot.scale.x, card.medalRoot.scale.y);

      card.glowSweep.alpha = sweepT < 1 ? 0.46 * Math.sin(Math.PI * sweepT) : 0;
      card.glowSweep.x = lerp(-180, 180, easeInOutCubic(sweepT));

      if (cameraPunch > 0) {
        const punchDecay = 1 - clamp((elapsed - 35) / 420, 0, 1);
        cameraRig.x =
          Math.sin(elapsed / 15.5) * cameraPunch * punchDecay +
          Math.cos(elapsed / 23) * cameraPunch * 0.2 * punchDecay;
        cameraRig.y = Math.cos(elapsed / 17.5) * cameraPunch * 0.65 * punchDecay;

        if (signalState.inSignalCut) {
          cameraRig.x *= 0.15;
          cameraRig.y *= 0.15;
        }
      }

      if (layers.shockwave) {
        const shockT = clamp((elapsed - timeline.shockStartMs) / timeline.shockDurationMs, 0, 1);
        layers.shockwave.alpha = 0.8 * (1 - shockT) * (1 - fadeOutT);
        layers.shockwave.scale.set(1 + shockT * 2.4);
      }

      if (layers.shockwave2) {
        const shock2T = clamp((elapsed - timeline.shock2StartMs) / timeline.shock2DurationMs, 0, 1);
        layers.shockwave2.alpha = 0.7 * (1 - shock2T) * (1 - fadeOutT);
        layers.shockwave2.scale.set(1 + shock2T * 2.9);
      }

      if (layers.aura) {
        layers.aura.alpha = (0.35 + Math.sin(elapsed / 120) * 0.1) * (1 - fadeOutT);
        const auraPulse = Math.sin(elapsed / 140) * (rarity === 'legendary' ? 0.08 : 0.05);
        layers.aura.scale.set(signalState.inSignalCut ? 1 : 1 + auraPulse);
      }

      const tailTextFade = 1 - tailFadeT * 0.32;
      const hardDisappear = 1 - signalState.disappearEase;
      const textRevealEase = easeOutCubic(textRevealT);
      const subtitleRevealEase = easeOutCubic(subtitleRevealT);
      const titleRevealOffset = (1 - textRevealEase) * 14;
      const subtitleRevealOffset = (1 - subtitleRevealEase) * 10;

      card.label.alpha = 0.9 * (1 - fadeOutT) * tailTextFade * hardDisappear;
      card.label.scale.set(1);
      card.title.y = 126 + titleRevealOffset;
      card.title.alpha =
        (signalState.inSignalCut ? 0.92 : 0.9 + Math.sin(elapsed / 160) * 0.06) *
        (1 - fadeOutT) *
        tailTextFade *
        textRevealEase *
        hardDisappear;
      card.title.scale.set(0.94 + textRevealEase * 0.06);

      card.subtitle.y = 154 + subtitleRevealOffset;
      card.subtitle.alpha = card.subtitle.text
        ? (signalState.inSignalCut ? 0.76 : 0.75 + Math.sin(elapsed / 190) * 0.08) *
          (1 - fadeOutT) *
          tailTextFade *
          subtitleRevealEase *
          hardDisappear
        : 0;
      card.subtitle.scale.set(0.96 + subtitleRevealEase * 0.04);

      const rgbSplit = signalState.signalStrength * 7;
      card.titleGhostR.alpha =
        signalState.signalStrength * 0.78 * (1 - fadeOutT) * textRevealEase * hardDisappear;
      card.titleGhostC.alpha =
        signalState.signalStrength * 0.78 * (1 - fadeOutT) * textRevealEase * hardDisappear;
      card.titleGhostR.x = -rgbSplit - signalState.signalSpikeC * 2;
      card.titleGhostC.x = rgbSplit + signalState.signalSpikeB * 2;
      card.titleGhostR.y = 126 + titleRevealOffset + signalState.signalSpikeB * 0.8;
      card.titleGhostC.y = 126 + titleRevealOffset - signalState.signalSpikeC * 0.8;

      card.labelGhostR.alpha = signalState.signalStrength * 0.62 * (1 - fadeOutT) * hardDisappear;
      card.labelGhostC.alpha = signalState.signalStrength * 0.62 * (1 - fadeOutT) * hardDisappear;
      card.labelGhostR.x = -rgbSplit * 0.74;
      card.labelGhostC.x = rgbSplit * 0.74;
      card.labelGhostR.y = 88 + signalState.signalSpikeB * 0.5;
      card.labelGhostC.y = 88 - signalState.signalSpikeC * 0.5;

      signalGlitchPlugin.update({
        elapsedMs: elapsed,
        fadeOutT,
        signalState,
      });

      particlesPlugin.update({
        elapsedMs: elapsed,
        deltaFrames,
        fadeOutT,
      });

      if (t >= 1) {
        app.ticker.remove(tick);
        root.destroy({ children: true });
        resolve();
      }
    };

    app.ticker.add(tick);
  });
}
