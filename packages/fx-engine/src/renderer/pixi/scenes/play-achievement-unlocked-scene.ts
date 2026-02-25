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

interface LightingOverrides {
  veilAlpha?: number;
  shadowAlpha?: number;
  keyLightBase?: number;
  keyLightImpact?: number;
  keyLightWindowMs?: number;
}

function asLightingOverrides(event: FxEvent): LightingOverrides {
  const metadata = event.metadata;
  if (!metadata || typeof metadata !== 'object') return {};
  const lighting = (metadata as { lighting?: unknown }).lighting;
  if (!lighting || typeof lighting !== 'object') return {};

  const source = lighting as Record<string, unknown>;
  const asNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

  return {
    veilAlpha: asNumber(source.veilAlpha),
    shadowAlpha: asNumber(source.shadowAlpha),
    keyLightBase: asNumber(source.keyLightBase),
    keyLightImpact: asNumber(source.keyLightImpact),
    keyLightWindowMs: asNumber(source.keyLightWindowMs),
  };
}

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
  const lighting = asLightingOverrides(event);
  const focusVeilTarget = clamp(lighting.veilAlpha ?? 0.5, 0, 0.78);
  const shadowStrength = clamp(lighting.shadowAlpha ?? 0.5, 0, 0.68);
  const keyLightBase = clamp(lighting.keyLightBase ?? 0.14, 0, 0.5);
  const keyLightImpactStrength = clamp(lighting.keyLightImpact ?? 0.24, 0, 0.6);
  const keyLightWindowMs = clamp(lighting.keyLightWindowMs ?? 60, 24, 240);
  const focusInDurationMs = 90;
  const focusOutDurationMs = 120;
  const focusOutStartMs = Math.max(
    focusInDurationMs,
    Math.min(timeline.fadeStartMs + 12, durationMs - focusOutDurationMs),
  );

  const width = app.screen.width;
  const height = app.screen.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const medalY = centerY - Math.min(64, height * 0.08);

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

  const card = await createAchievementCard({
    cameraRig,
    event,
    profile,
    rarity,
    viewportWidth: width,
    centerX,
    medalY,
  });

  const glitchBlockWidth = Math.min(card.effectWidth, width - 72);
  const glitchBlockTop = -74;
  const glitchBlockBottom = Math.max(
    card.subtitleBaseY + card.subtitle.height / 2 + 30,
    card.effectHeight - 12,
  );
  const glitchBlockHeight = Math.min(glitchBlockBottom - glitchBlockTop, height * 0.62);
  const glitchBlockX = centerX - glitchBlockWidth / 2;
  const glitchBlockY = medalY + glitchBlockTop;

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
      const focusInT = clamp(elapsed / focusInDurationMs, 0, 1);
      const focusOutT = clamp((elapsed - focusOutStartMs) / focusOutDurationMs, 0, 1);

      const signalState = computeSignalState({
        elapsedMs: elapsed,
        signalCutStartMs: timeline.signalCutStartMs,
        signalDurationMs: timeline.signalDurationMs,
        preSignalLeadMs: timeline.preSignalLeadMs,
      });
      const hardDisappear = 1 - signalState.disappearEase;

      layers.focusVeil.alpha =
        focusVeilTarget * easeOutCubic(focusInT) * (1 - focusOutT) * hardDisappear;

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
      const textRevealEase = easeOutCubic(textRevealT);
      const subtitleRevealEase = easeOutCubic(subtitleRevealT);
      const titleRevealOffset = (1 - textRevealEase) * 14;
      const subtitleRevealOffset = (1 - subtitleRevealEase) * 10;
      const shadowReveal = textRevealEase;
      const shadowTail = 1 - tailFadeT * 0.24;
      const impactT = clamp((elapsed - timeline.attackEndMs) / keyLightWindowMs, 0, 1);
      const keyLightImpact = Math.sin(Math.PI * impactT);
      const shadowImpactT = clamp((elapsed - timeline.attackEndMs + 18) / 96, 0, 1);
      const shadowImpact = Math.sin(Math.PI * shadowImpactT);
      const keyLightReveal = clamp(
        (elapsed - timeline.textRevealStartMs + 42) / Math.max(1, timeline.textRevealDurationMs),
        0,
        1,
      );
      const keyLightSweepT = clamp(
        (elapsed - Math.max(timeline.sweepStartMs, timeline.textRevealStartMs - 36)) /
          Math.max(1, timeline.sweepDurationMs * 0.58),
        0,
        1,
      );

      card.coldShadow.alpha =
        shadowStrength *
        (0.78 + shadowImpact * 0.22) *
        shadowReveal *
        shadowTail *
        (1 - fadeOutT) *
        hardDisappear;
      card.coldShadow.y = 24 + (1 - shadowReveal) * 14 + shadowImpact * 5;
      card.coldShadow.scale.set(
        0.9 + shadowReveal * 0.14 + shadowImpact * 0.08,
        0.78 + shadowReveal * 0.15 - shadowImpact * 0.05,
      );
      card.keyLight.alpha =
        (keyLightBase * shadowReveal + keyLightImpact * keyLightImpactStrength * keyLightReveal) *
        (1 - fadeOutT) *
        hardDisappear;
      card.keyLight.x = lerp(-26, 18, easeInOutCubic(keyLightSweepT));
      card.keyLight.scale.set(0.94 + shadowReveal * 0.12 + keyLightImpact * 0.06, 1);

      card.label.alpha = 0.9 * (1 - fadeOutT) * tailTextFade * hardDisappear;
      card.label.scale.set(1);
      card.label.y = card.labelBaseY;
      card.title.y = card.titleBaseY + titleRevealOffset;
      card.titleGlow.y = card.title.y;
      card.titleGlow.alpha =
        (signalState.inSignalCut ? 0.26 : 0.22 + Math.sin(elapsed / 170) * 0.03) *
        (1 - fadeOutT) *
        tailTextFade *
        textRevealEase *
        hardDisappear;
      card.title.alpha =
        (signalState.inSignalCut ? 0.96 : 0.95 + Math.sin(elapsed / 160) * 0.04) *
        (1 - fadeOutT) *
        tailTextFade *
        textRevealEase *
        hardDisappear;
      card.title.scale.set(0.94 + textRevealEase * 0.06);

      card.subtitle.y = card.subtitleBaseY + subtitleRevealOffset;
      card.subtitleGlow.y = card.subtitle.y;
      card.subtitleGlow.alpha = card.subtitle.text
        ? (signalState.inSignalCut ? 0.18 : 0.15 + Math.sin(elapsed / 210) * 0.02) *
          (1 - fadeOutT) *
          tailTextFade *
          subtitleRevealEase *
          hardDisappear
        : 0;
      card.subtitle.alpha = card.subtitle.text
        ? (signalState.inSignalCut ? 0.8 : 0.82 + Math.sin(elapsed / 190) * 0.06) *
          (1 - fadeOutT) *
          tailTextFade *
          subtitleRevealEase *
          hardDisappear
        : 0;
      card.subtitle.scale.set(0.96 + subtitleRevealEase * 0.04);

      const rgbSplit = signalState.signalStrength * 5.5;
      card.titleGhostR.alpha =
        signalState.signalStrength * 0.46 * (1 - fadeOutT) * textRevealEase * hardDisappear;
      card.titleGhostC.alpha =
        signalState.signalStrength * 0.46 * (1 - fadeOutT) * textRevealEase * hardDisappear;
      card.titleGhostR.x = -rgbSplit - signalState.signalSpikeC * 2;
      card.titleGhostC.x = rgbSplit + signalState.signalSpikeB * 2;
      card.titleGhostR.y = card.titleBaseY + titleRevealOffset + signalState.signalSpikeB * 0.8;
      card.titleGhostC.y = card.titleBaseY + titleRevealOffset - signalState.signalSpikeC * 0.8;

      card.labelGhostR.alpha = signalState.signalStrength * 0.34 * (1 - fadeOutT) * hardDisappear;
      card.labelGhostC.alpha = signalState.signalStrength * 0.34 * (1 - fadeOutT) * hardDisappear;
      card.labelGhostR.x = -rgbSplit * 0.74;
      card.labelGhostC.x = rgbSplit * 0.74;
      card.labelGhostR.y = card.labelBaseY + signalState.signalSpikeB * 0.5;
      card.labelGhostC.y = card.labelBaseY - signalState.signalSpikeC * 0.5;

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
