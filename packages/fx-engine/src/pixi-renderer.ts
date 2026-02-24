import {
  Application,
  BLEND_MODES,
  Container,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js';
import type { AchievementFxEvent, FxRarity, FxRenderOptions, FxRenderer } from './types';

type Spark = {
  shape: Graphics;
  vx: number;
  vy: number;
  life: number;
};

type Debris = {
  shape: Graphics;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  maxLife: number;
  drag: number;
  spinDamp: number;
};

type SmokeCloud = {
  shape: Graphics;
  vx: number;
  vy: number;
  grow: number;
  life: number;
  maxLife: number;
  alphaBase: number;
};

type RarityVisualProfile = {
  ribbon: number;
  overlayTint: number;
  medalFill: number;
  medalStroke: number;
  sparkPrimary: number;
  sparkSecondary: number;
  debrisColor: number;
  smokeColor: number;
  titleColor: number;
  labelColor: number;
  durationMs: number;
  flashAlpha: number;
  vignette: number;
  sparkCount: number;
  debrisCount: number;
  smokeCount: number;
  settleScale: number;
  entryOffsetY: number;
  shakePx: number;
  cameraPunch: number;
  shockwave: boolean;
  doubleBurst: boolean;
};

const RARITY_VISUAL: Record<FxRarity, RarityVisualProfile> = {
  common: {
    ribbon: 0x34424f,
    overlayTint: 0x5e7a93,
    medalFill: 0x7b7464,
    medalStroke: 0xb6aa90,
    sparkPrimary: 0xc9d1dc,
    sparkSecondary: 0x8ab2d4,
    debrisColor: 0x4b515c,
    smokeColor: 0x72809a,
    titleColor: 0xe5e9ef,
    labelColor: 0xc2cbd8,
    durationMs: 1050,
    flashAlpha: 0.09,
    vignette: 0.12,
    sparkCount: 6,
    debrisCount: 4,
    smokeCount: 5,
    settleScale: 1.03,
    entryOffsetY: 18,
    shakePx: 0,
    cameraPunch: 0,
    shockwave: false,
    doubleBurst: false,
  },
  rare: {
    ribbon: 0x2f4e63,
    overlayTint: 0x3d6f9e,
    medalFill: 0x748a9b,
    medalStroke: 0xb8d8ef,
    sparkPrimary: 0xaed9ff,
    sparkSecondary: 0xe2d3a0,
    debrisColor: 0x566070,
    smokeColor: 0x7a8ea8,
    titleColor: 0xeaf3ff,
    labelColor: 0xc8def7,
    durationMs: 1550,
    flashAlpha: 0.24,
    vignette: 0.28,
    sparkCount: 18,
    debrisCount: 10,
    smokeCount: 12,
    settleScale: 1.1,
    entryOffsetY: 28,
    shakePx: 0.8,
    cameraPunch: 1.3,
    shockwave: false,
    doubleBurst: false,
  },
  epic: {
    ribbon: 0x3b355f,
    overlayTint: 0x5e3f9f,
    medalFill: 0x9e8dcb,
    medalStroke: 0xe7d9ff,
    sparkPrimary: 0xd8c7ff,
    sparkSecondary: 0x8fd1ff,
    debrisColor: 0x6a5a87,
    smokeColor: 0x7b74ad,
    titleColor: 0xf2eaff,
    labelColor: 0xd8caef,
    durationMs: 1850,
    flashAlpha: 0.32,
    vignette: 0.38,
    sparkCount: 30,
    debrisCount: 22,
    smokeCount: 20,
    settleScale: 1.13,
    entryOffsetY: 40,
    shakePx: 1.6,
    cameraPunch: 2.8,
    shockwave: true,
    doubleBurst: false,
  },
  legendary: {
    ribbon: 0x4f3a1f,
    overlayTint: 0x926219,
    medalFill: 0xb68d2c,
    medalStroke: 0xffe6a2,
    sparkPrimary: 0xffd56b,
    sparkSecondary: 0xfff4c9,
    debrisColor: 0x8d6a2c,
    smokeColor: 0x9b8a64,
    titleColor: 0xfff0bf,
    labelColor: 0xf5d98f,
    durationMs: 2150,
    flashAlpha: 0.48,
    vignette: 0.5,
    sparkCount: 44,
    debrisCount: 32,
    smokeCount: 28,
    settleScale: 1.18,
    entryOffsetY: 56,
    shakePx: 2.6,
    cameraPunch: 4.6,
    shockwave: true,
    doubleBurst: true,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class PixiFxRenderer implements FxRenderer {
  private app: Application | null = null;
  private disabled = false;

  constructor(private readonly host: HTMLElement) {}

  async playAchievement(event: AchievementFxEvent, options: FxRenderOptions): Promise<void> {
    if (this.disabled || options.mode === 'off') return;

    const ready = this.ensureApp();
    if (!ready || !this.app) return;

    const rarity = event.rarity ?? 'common';
    const profile = RARITY_VISUAL[rarity];
    const isLite = options.mode === 'lite' || options.reducedMotion;
    const liteFactor = isLite ? 0.55 : 1;
    const durationMs = Math.round(profile.durationMs * (isLite ? 0.78 : 1));
    const flashAlpha = profile.flashAlpha * liteFactor;
    const vignetteTarget = profile.vignette * (isLite ? 0.5 : 1);
    const sparkCount = Math.max(2, Math.round(profile.sparkCount * liteFactor));
    const debrisCount = Math.max(1, Math.round(profile.debrisCount * liteFactor));
    const smokeCount = Math.max(2, Math.round(profile.smokeCount * liteFactor));
    const shockwaveEnabled = profile.shockwave && options.mode === 'epic' && !isLite;
    const shakePx = profile.shakePx * liteFactor;
    const cameraPunch = profile.cameraPunch * liteFactor;

    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const medalY = centerY - Math.min(64, height * 0.08);

    const root = new Container();
    this.app.stage.addChild(root);

    const cameraRig = new Container();
    root.addChild(cameraRig);

    const tint = new Graphics();
    tint.beginFill(profile.overlayTint, 0);
    tint.drawRect(0, 0, width, height);
    tint.endFill();
    tint.blendMode = BLEND_MODES.ADD;
    root.addChild(tint);

    const vignette = new Graphics();
    vignette.beginFill(0x000000, 0);
    vignette.drawRect(0, 0, width, height);
    vignette.endFill();
    root.addChild(vignette);

    const flash = new Graphics();
    flash.beginFill(0xf5f4ea, 0);
    flash.drawRect(0, 0, width, height);
    flash.endFill();
    root.addChild(flash);

    const smokeContainer = new Container();
    cameraRig.addChild(smokeContainer);

    const shockwave = new Graphics();
    if (shockwaveEnabled) {
      shockwave.lineStyle(5, profile.sparkSecondary, 0.8);
      shockwave.drawCircle(0, 0, 84);
      shockwave.x = centerX;
      shockwave.y = medalY;
      shockwave.alpha = 0;
      cameraRig.addChild(shockwave);
    }

    const shockwave2 = new Graphics();
    if (shockwaveEnabled && profile.doubleBurst) {
      shockwave2.lineStyle(3, profile.sparkPrimary, 0.85);
      shockwave2.drawCircle(0, 0, 68);
      shockwave2.x = centerX;
      shockwave2.y = medalY;
      shockwave2.alpha = 0;
      cameraRig.addChild(shockwave2);
    }

    const aura = new Graphics();
    if (rarity === 'epic' || rarity === 'legendary') {
      aura.beginFill(profile.sparkSecondary, rarity === 'legendary' ? 0.18 : 0.12);
      aura.drawCircle(0, 0, rarity === 'legendary' ? 110 : 90);
      aura.endFill();
      aura.blendMode = BLEND_MODES.ADD;
      aura.x = centerX;
      aura.y = medalY;
      aura.alpha = 0;
      cameraRig.addChild(aura);
    }

    const medalRoot = new Container();
    medalRoot.x = centerX;
    medalRoot.y = medalY;
    medalRoot.alpha = 0;
    medalRoot.scale.set(0.62);
    cameraRig.addChild(medalRoot);

    const ribbon = new Graphics();
    ribbon.beginFill(profile.ribbon, 0.95);
    ribbon.drawRoundedRect(-180, -40, 360, 80, 22);
    ribbon.endFill();
    medalRoot.addChild(ribbon);

    const medal = new Graphics();
    medal.beginFill(profile.medalFill, 1);
    medal.drawCircle(0, 0, 62);
    medal.endFill();
    medal.lineStyle(5, profile.medalStroke, 0.95);
    medal.drawCircle(0, 0, 58);
    medalRoot.addChild(medal);

    const iconText = new Text(event.icon ?? '★', {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 42,
      fontWeight: '700',
      fill: 0x1a1a1a,
    });
    iconText.anchor.set(0.5);
    iconText.y = -2;
    medalRoot.addChild(iconText);

    const glowSweep = new Graphics();
    glowSweep.beginFill(0xffffff, 0.2);
    glowSweep.drawRoundedRect(-34, -70, 68, 140, 14);
    glowSweep.endFill();
    glowSweep.rotation = -0.45;
    glowSweep.blendMode = BLEND_MODES.ADD;
    glowSweep.alpha = 0;
    medalRoot.addChild(glowSweep);

    const labelStyle = new TextStyle({
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 1.8,
      fill: profile.labelColor,
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 12,
      dropShadowDistance: 0,
    });
    const label = new Text(`${rarity.toUpperCase()} UNLOCKED`, labelStyle);
    label.anchor.set(0.5);
    label.y = 88;
    medalRoot.addChild(label);

    const title = new Text(event.title, {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: rarity === 'legendary' ? 32 : rarity === 'epic' ? 30 : 26,
      fontWeight: '800',
      fill: profile.titleColor,
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 20,
      dropShadowDistance: 0,
    });
    title.anchor.set(0.5);
    title.y = 126;
    medalRoot.addChild(title);

    const subtitle = new Text(event.subtitle ?? '', {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 16,
      fontWeight: '600',
      fill: 0xbdc6d2,
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 10,
      dropShadowDistance: 0,
    });
    subtitle.anchor.set(0.5);
    subtitle.y = 154;
    subtitle.alpha = event.subtitle ? 0.95 : 0;
    medalRoot.addChild(subtitle);

    const sparks: Spark[] = [];
    const debris: Debris[] = [];
    const smokeClouds: SmokeCloud[] = [];

    const createSmokeField = (count: number) => {
      for (let i = 0; i < count; i++) {
        const cloud = new Graphics();
        const radius = randomRange(rarity === 'legendary' ? 28 : 18, rarity === 'legendary' ? 70 : 46);
        cloud.beginFill(profile.smokeColor, randomRange(0.08, 0.22) * (isLite ? 0.6 : 1));
        cloud.drawCircle(0, 0, radius);
        cloud.endFill();
        cloud.blendMode = BLEND_MODES.NORMAL;
        cloud.x = centerX + randomRange(-95, 95);
        cloud.y = medalY + randomRange(20, 140);
        cloud.scale.set(randomRange(0.65, 1.1));
        smokeContainer.addChild(cloud);

        smokeClouds.push({
          shape: cloud,
          vx: randomRange(-0.35, 0.35) * liteFactor,
          vy: randomRange(-0.95, -0.22) * liteFactor,
          grow: randomRange(0.002, 0.01) * liteFactor,
          life: randomRange(0, 14),
          maxLife: randomRange(48, 96),
          alphaBase: cloud.alpha,
        });
      }
    };

    const createBurst = (count: number, spread = 1) => {
      for (let i = 0; i < count; i++) {
        const spark = new Graphics();
        const radius = Math.random() * (rarity === 'legendary' ? 4.5 : 3.1) + 1.1;
        spark.beginFill(Math.random() > 0.35 ? profile.sparkPrimary : profile.sparkSecondary, 0.95);
        spark.drawCircle(0, 0, radius);
        spark.endFill();
        spark.x = centerX + (Math.random() - 0.5) * 8;
        spark.y = medalY + (Math.random() - 0.5) * 8;
        cameraRig.addChild(spark);

        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const baseSpeed = rarity === 'legendary' ? 5.4 : rarity === 'epic' ? 4.8 : 3.6;
        const speed = (Math.random() * baseSpeed + 1.9) * liteFactor * spread;
        sparks.push({
          shape: spark,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - randomRange(1.3, 2.2),
          life: 0,
        });
      }

      const debrisSpawn = Math.max(1, Math.round(debrisCount * spread * 0.7));
      for (let i = 0; i < debrisSpawn; i++) {
        const chunk = new Graphics();
        const size = randomRange(2.5, rarity === 'legendary' ? 8.8 : 6.6);
        chunk.beginFill(profile.debrisColor, randomRange(0.65, 0.95));
        if (Math.random() > 0.5) {
          chunk.drawRoundedRect(-size * 0.45, -size * 0.3, size, size * randomRange(0.35, 0.78), 1.2);
        } else {
          chunk.drawPolygon([
            -size * 0.45, -size * 0.25,
            size * 0.42, -size * 0.28,
            size * 0.15, size * 0.4,
            -size * 0.36, size * 0.35,
          ]);
        }
        chunk.endFill();
        chunk.x = centerX + randomRange(-10, 10);
        chunk.y = medalY + randomRange(-6, 7);
        chunk.rotation = randomRange(0, Math.PI * 2);
        cameraRig.addChild(chunk);

        const angle = randomRange(-Math.PI * 0.9, Math.PI * 0.1);
        const speed = randomRange(2.8, rarity === 'legendary' ? 8.6 : 6.1) * spread * liteFactor;
        debris.push({
          shape: chunk,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - randomRange(1.8, 3.4),
          vr: randomRange(-0.35, 0.35),
          life: 0,
          maxLife: randomRange(38, 96),
          drag: randomRange(0.94, 0.975),
          spinDamp: randomRange(0.95, 0.985),
        });
      }
    };

    createSmokeField(smokeCount);
    createBurst(sparkCount);
    let didSecondBurst = false;

    const app = this.app;
    const start = performance.now();
    let lastFrame = start;
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (!this.app) {
          app.ticker.remove(tick);
          resolve();
          return;
        }

        const elapsed = performance.now() - start;
        const deltaFrames = Math.min(2.5, (performance.now() - lastFrame) / 16.6667);
        lastFrame = performance.now();
        const t = clamp(elapsed / durationMs, 0, 1);

        const revealT = clamp(elapsed / 260, 0, 1);
        const settleT = clamp((elapsed - 160) / 240, 0, 1);
        const sweepT = clamp((elapsed - 260) / 480, 0, 1);
        const fadeOutT = clamp((elapsed - (durationMs - 360)) / 360, 0, 1);

        tint.alpha =
          lerp(0, rarity === 'legendary' ? 0.22 : rarity === 'epic' ? 0.12 : 0.05, revealT) *
          (1 - fadeOutT);
        vignette.alpha = lerp(0, vignetteTarget, easeOutCubic(revealT)) * (1 - fadeOutT);
        flash.alpha = flashAlpha * (1 - easeOutCubic(clamp(elapsed / 180, 0, 1))) * (1 - fadeOutT);
        if (profile.doubleBurst && elapsed > 250 && elapsed < 420) {
          flash.alpha += 0.14 * Math.sin(((elapsed - 250) / 170) * Math.PI);
        }

        medalRoot.alpha = lerp(0, 1, easeOutCubic(revealT)) * (1 - fadeOutT);
        const peakScale = profile.settleScale;
        const settleScale =
          settleT > 0 ? lerp(peakScale, 1, easeOutCubic(settleT)) : lerp(0.62, peakScale, revealT);
        medalRoot.scale.set(settleScale);
        medalRoot.y = lerp(medalY + profile.entryOffsetY, medalY, easeOutCubic(revealT));
        medalRoot.x = centerX + Math.sin(elapsed / 45) * shakePx * (1 - revealT) * (1 - fadeOutT);

        glowSweep.alpha = sweepT < 1 ? 0.75 * Math.sin(Math.PI * sweepT) : 0;
        glowSweep.x = lerp(-180, 180, easeInOutCubic(sweepT));

        if (cameraPunch > 0) {
          const punchDecay = 1 - clamp((elapsed - 35) / 420, 0, 1);
          cameraRig.x =
            Math.sin(elapsed / 15.5) * cameraPunch * punchDecay +
            Math.cos(elapsed / 23) * cameraPunch * 0.2 * punchDecay;
          cameraRig.y = Math.cos(elapsed / 17.5) * cameraPunch * 0.65 * punchDecay;
        }

        if (shockwaveEnabled) {
          const shockT = clamp((elapsed - 120) / 620, 0, 1);
          shockwave.alpha = 0.8 * (1 - shockT) * (1 - fadeOutT);
          shockwave.scale.set(1 + shockT * 2.4);
        }
        if (shockwaveEnabled && profile.doubleBurst) {
          const shock2T = clamp((elapsed - 300) / 700, 0, 1);
          shockwave2.alpha = 0.7 * (1 - shock2T) * (1 - fadeOutT);
          shockwave2.scale.set(1 + shock2T * 2.9);
        }
        if (rarity === 'epic' || rarity === 'legendary') {
          aura.alpha = (0.35 + Math.sin(elapsed / 120) * 0.1) * (1 - fadeOutT);
          aura.scale.set(1 + Math.sin(elapsed / 140) * (rarity === 'legendary' ? 0.08 : 0.05));
        }

        label.alpha = 0.9 * (1 - fadeOutT);
        title.alpha = (0.92 + Math.sin(elapsed / 140) * 0.08) * (1 - fadeOutT);
        subtitle.alpha = subtitle.text
          ? (0.75 + Math.sin(elapsed / 190) * 0.08) * (1 - fadeOutT)
          : 0;

        const sparkFade = clamp((elapsed - 120) / 650, 0, 1);
        for (const spark of sparks) {
          spark.life += 0.02 * deltaFrames;
          spark.shape.x += spark.vx * deltaFrames;
          spark.shape.y += spark.vy * deltaFrames;
          spark.vy += 0.048 * deltaFrames;
          spark.shape.alpha = (1 - sparkFade) * (1 - spark.life * 0.65);
          spark.shape.scale.set(1 + spark.life * 0.35);
        }

        for (const chunk of debris) {
          chunk.life += deltaFrames;
          chunk.shape.x += chunk.vx * deltaFrames;
          chunk.shape.y += chunk.vy * deltaFrames;
          chunk.vy += 0.18 * deltaFrames;
          chunk.vx *= Math.pow(chunk.drag, deltaFrames);
          chunk.shape.rotation += chunk.vr * deltaFrames;
          chunk.vr *= Math.pow(chunk.spinDamp, deltaFrames);

          const lifeT = clamp(chunk.life / chunk.maxLife, 0, 1);
          chunk.shape.alpha = (1 - lifeT) * (1 - fadeOutT) * 0.95;
        }

        for (const smoke of smokeClouds) {
          smoke.life += deltaFrames;
          smoke.shape.x += smoke.vx * deltaFrames;
          smoke.shape.y += smoke.vy * deltaFrames;
          smoke.shape.scale.set(smoke.shape.scale.x + smoke.grow * deltaFrames);

          const lifeT = clamp(smoke.life / smoke.maxLife, 0, 1);
          smoke.shape.alpha = smoke.alphaBase * (1 - lifeT) * (1 - fadeOutT * 0.8);
        }

        if (profile.doubleBurst && !didSecondBurst && elapsed > 260) {
          didSecondBurst = true;
          createBurst(Math.max(6, Math.round(sparkCount * 0.45)), 1.2);
        }

        if (t >= 1) {
          app.ticker.remove(tick);
          root.destroy({ children: true });
          resolve();
        }
      };

      app.ticker.add(tick);
    });
  }

  dispose(): void {
    if (!this.app) return;
    this.app.destroy(true, {
      children: true,
      texture: true,
      baseTexture: true,
    });
    this.app = null;
  }

  private ensureApp(): boolean {
    if (this.disabled) return false;
    if (this.app) return true;

    if (typeof window === 'undefined') {
      this.disabled = true;
      return false;
    }

    try {
      const hostWidth = this.host.clientWidth || window.innerWidth;
      const hostHeight = this.host.clientHeight || window.innerHeight;
      this.app = new Application({
        width: hostWidth,
        height: hostHeight,
        antialias: true,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        resizeTo: this.host,
      });

      const view = this.app.view as HTMLCanvasElement;
      view.style.position = 'absolute';
      view.style.inset = '0';
      view.style.width = '100%';
      view.style.height = '100%';
      view.style.pointerEvents = 'none';
      this.host.appendChild(view);

      return true;
    } catch {
      this.disabled = true;
      return false;
    }
  }
}
