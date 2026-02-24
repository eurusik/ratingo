import {
  Application,
  BLEND_MODES,
  Container,
  Graphics,
  Sprite,
  Texture,
  Text,
  TextStyle,
} from 'pixi.js';
import type { AchievementFxEvent, FxRarity, FxRenderOptions, FxRenderer } from './types';
import { __iconNode as starIconNode } from 'lucide-react/dist/esm/icons/star.js';
import { __iconNode as shieldIconNode } from 'lucide-react/dist/esm/icons/shield.js';
import { __iconNode as ribbonIconNode } from 'lucide-react/dist/esm/icons/ribbon.js';
import { __iconNode as trophyIconNode } from 'lucide-react/dist/esm/icons/trophy.js';

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

type LucideIconNode = [string, Record<string, string | number>][];

type IconKey = 'star' | 'shield' | 'ribbon' | 'trophy';

const ICON_NODES: Record<IconKey, LucideIconNode> = {
  star: starIconNode as LucideIconNode,
  shield: shieldIconNode as LucideIconNode,
  ribbon: ribbonIconNode as LucideIconNode,
  trophy: trophyIconNode as LucideIconNode,
};

const ICON_TEXTURE_CACHE = new Map<string, Texture>();
const AUDIO_REFERENCE_MS = 4729;

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
    durationMs: 900,
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
    durationMs: 1100,
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
    durationMs: 1300,
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
    ribbon: 0x4a4334,
    overlayTint: 0x5f553a,
    medalFill: 0x8d7a4c,
    medalStroke: 0xd8c690,
    sparkPrimary: 0xd7bd79,
    sparkSecondary: 0xe6dbb6,
    debrisColor: 0x8d6a2c,
    smokeColor: 0x9b8a64,
    titleColor: 0xdfd1a8,
    labelColor: 0xc2b286,
    durationMs: 1450,
    flashAlpha: 0.34,
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

function resolveIconKey(rarity: FxRarity, icon?: string): IconKey {
  const token = (icon ?? '').toLowerCase();
  if (token.includes('trophy') || token.includes('cup')) return 'trophy';
  if (token.includes('shield')) return 'shield';
  if (token.includes('ribbon') || token.includes('medal')) return 'ribbon';
  if (token.includes('star')) return 'star';

  if (rarity === 'legendary') return 'trophy';
  if (rarity === 'epic') return 'ribbon';
  if (rarity === 'rare') return 'shield';
  return 'star';
}

function iconNodeToSvg(iconNode: LucideIconNode, strokeHex: string): string {
  const nodes = iconNode
    .map(([tag, attrs]) => {
      const attrsString = Object.entries(attrs)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(' ');
      return `<${tag} ${attrsString} />`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${strokeHex}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${nodes}</svg>`;
}

function getIconTexture(iconKey: IconKey, strokeHex: string): Texture {
  const cacheKey = `${iconKey}:${strokeHex}`;
  const cached = ICON_TEXTURE_CACHE.get(cacheKey);
  if (cached) return cached;

  const svg = iconNodeToSvg(ICON_NODES[iconKey], strokeHex);
  const texture = Texture.from(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  ICON_TEXTURE_CACHE.set(cacheKey, texture);
  return texture;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function impactSpike(t: number, start: number, end: number): number {
  if (t <= start || t >= end) return 0;
  const mid = (start + end) * 0.5;
  if (t <= mid) return (t - start) / Math.max(0.0001, mid - start);
  return (end - t) / Math.max(0.0001, end - mid);
}

function hash01(seed: number): number {
  const value = Math.sin(seed * 127.1) * 43758.5453123;
  return value - Math.floor(value);
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
    const externalDurationMs = options.durationMs && options.durationMs > 0 ? options.durationMs : null;
    const durationMs = Math.round(externalDurationMs ?? profile.durationMs);
    const useAudioTimeline = externalDurationMs !== null && durationMs > 1800;
    const audioScale = durationMs / AUDIO_REFERENCE_MS;
    const fromAudio = (ms: number) => Math.round(ms * audioScale);

    const attackEndMs = useAudioTimeline ? fromAudio(760) : Math.min(180, durationMs * 0.16);
    const settleStartMs = useAudioTimeline ? fromAudio(520) : durationMs * 0.09;
    const settleDurationMs = useAudioTimeline ? fromAudio(340) : Math.min(300, durationMs * 0.2);
    const sweepStartMs = useAudioTimeline ? fromAudio(560) : durationMs * 0.15;
    const sweepDurationMs = useAudioTimeline ? fromAudio(460) : Math.min(320, durationMs * 0.24);
    const tailStartMs = useAudioTimeline ? fromAudio(3120) : durationMs * 0.7;
    const signalDurationMs = useAudioTimeline
      ? fromAudio(220)
      : Math.min(300, Math.max(180, durationMs * 0.2));
    const signalCutStartMs = Math.max(0, durationMs - signalDurationMs);
    const fadeDurationMs = useAudioTimeline ? fromAudio(70) : Math.min(110, durationMs * 0.075);
    const fadeStartMs = Math.max(0, durationMs - fadeDurationMs);
    const secondFlashStartMs = useAudioTimeline ? fromAudio(730) : durationMs * 0.25;
    const secondFlashEndMs = useAudioTimeline ? fromAudio(980) : durationMs * 0.4;
    const secondBurstMs = useAudioTimeline ? fromAudio(840) : durationMs * 0.24;
    const shockStartMs = useAudioTimeline ? fromAudio(510) : durationMs * 0.07;
    const shockDurationMs = useAudioTimeline ? fromAudio(430) : durationMs * 0.18;
    const shock2StartMs = useAudioTimeline ? fromAudio(830) : durationMs * 0.18;
    const shock2DurationMs = useAudioTimeline ? fromAudio(440) : durationMs * 0.22;
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
    const glitchBlockWidth = Math.min(width * 0.7, 900);
    const glitchBlockHeight = Math.min(height * 0.5, 420);
    const glitchBlockX = centerX - glitchBlockWidth / 2;
    const glitchBlockY = medalY - Math.min(170, height * 0.24);

    const root = new Container();
    this.app.stage.addChild(root);

    const cameraRig = new Container();
    root.addChild(cameraRig);

    const glitchMask = new Graphics();
    glitchMask.beginFill(0xffffff, 1);
    glitchMask.drawRoundedRect(glitchBlockX, glitchBlockY, glitchBlockWidth, glitchBlockHeight, 28);
    glitchMask.endFill();
    glitchMask.visible = false;
    root.addChild(glitchMask);

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

    const scanline = new Graphics();
    for (let y = 0; y < height; y += 4) {
      const alpha = (y / 4) % 2 === 0 ? 0.028 : 0.012;
      scanline.beginFill(0x000000, alpha);
      scanline.drawRect(0, y, width, 2);
      scanline.endFill();
    }
    scanline.alpha = 0;
    scanline.mask = glitchMask;
    root.addChild(scanline);

    const noiseDots = new Graphics();
    for (let i = 0; i < 170; i++) {
      noiseDots.beginFill(Math.random() > 0.58 ? 0xc7b994 : 0x6a6a6a, randomRange(0.01, 0.06));
      noiseDots.drawRect(randomRange(0, width), randomRange(0, height), randomRange(0.8, 2), randomRange(0.8, 2));
      noiseDots.endFill();
    }
    noiseDots.alpha = 0;
    noiseDots.mask = glitchMask;
    root.addChild(noiseDots);

    const flash = new Graphics();
    flash.beginFill(0xf5f4ea, 0);
    flash.drawRect(0, 0, width, height);
    flash.endFill();
    root.addChild(flash);

    const glitchBands = new Graphics();
    glitchBands.alpha = 0;
    glitchBands.mask = glitchMask;
    root.addChild(glitchBands);

    const interferenceStrips = new Graphics();
    interferenceStrips.alpha = 0;
    interferenceStrips.mask = glitchMask;
    interferenceStrips.blendMode = BLEND_MODES.NORMAL;
    root.addChild(interferenceStrips);

    const signalStatic = new Graphics();
    signalStatic.alpha = 0;
    signalStatic.mask = glitchMask;
    signalStatic.blendMode = BLEND_MODES.NORMAL;
    root.addChild(signalStatic);

    const cutPulse = new Graphics();
    cutPulse.beginFill(0x000000, 1);
    cutPulse.drawRect(0, 0, width, height);
    cutPulse.endFill();
    cutPulse.alpha = 0;
    cutPulse.mask = glitchMask;
    root.addChild(cutPulse);

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

    const iconKey = resolveIconKey(rarity, event.icon);
    const iconTexture = getIconTexture(iconKey, '#1f1f1f');
    const iconSprite = new Sprite(iconTexture);
    iconSprite.anchor.set(0.5);
    iconSprite.y = -2;
    const iconSize = rarity === 'legendary' ? 50 : rarity === 'epic' ? 48 : 44;
    iconSprite.width = iconSize;
    iconSprite.height = iconSize;
    medalRoot.addChild(iconSprite);

    const glowSweep = new Graphics();
    glowSweep.beginFill(0xd9ccb0, 0.13);
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
    const label = new Text(rarity === 'legendary' ? 'PROMOTION UNLOCKED' : `${rarity.toUpperCase()} UNLOCKED`, labelStyle);
    label.anchor.set(0.5);
    label.y = 88;
    medalRoot.addChild(label);

    const title = new Text(event.title, {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: rarity === 'legendary' ? 28 : rarity === 'epic' ? 30 : 26,
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

    const titleGhostR = new Text(event.title, {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: rarity === 'legendary' ? 28 : rarity === 'epic' ? 30 : 26,
      fontWeight: '800',
      fill: 0xff4f4f,
      align: 'center',
    });
    titleGhostR.anchor.set(0.5);
    titleGhostR.y = 126;
    titleGhostR.alpha = 0;
    medalRoot.addChild(titleGhostR);

    const titleGhostC = new Text(event.title, {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: rarity === 'legendary' ? 28 : rarity === 'epic' ? 30 : 26,
      fontWeight: '800',
      fill: 0x63d9ff,
      align: 'center',
    });
    titleGhostC.anchor.set(0.5);
    titleGhostC.y = 126;
    titleGhostC.alpha = 0;
    medalRoot.addChild(titleGhostC);

    const subtitle = new Text(event.subtitle ?? '', {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 14,
      fontWeight: '600',
      fill: 0xa0a5b0,
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

    const achievementMask = new Container();
    achievementMask.x = centerX;
    achievementMask.y = medalY;
    achievementMask.scale.set(0.62);
    achievementMask.alpha = 0.001;
    cameraRig.addChild(achievementMask);

    const maskRibbon = new Graphics();
    maskRibbon.beginFill(0xffffff, 1);
    maskRibbon.drawRoundedRect(-180, -40, 360, 80, 22);
    maskRibbon.endFill();
    achievementMask.addChild(maskRibbon);

    const maskMedal = new Graphics();
    maskMedal.beginFill(0xffffff, 1);
    maskMedal.drawCircle(0, 0, 64);
    maskMedal.endFill();
    achievementMask.addChild(maskMedal);

    const maskLabel = new Graphics();
    const labelMaskWidth = Math.max(180, label.width + 24);
    maskLabel.beginFill(0xffffff, 1);
    maskLabel.drawRoundedRect(-labelMaskWidth / 2, 76, labelMaskWidth, 22, 8);
    maskLabel.endFill();
    achievementMask.addChild(maskLabel);

    const maskTitle = new Graphics();
    const titleMaskWidth = Math.max(220, title.width + 28);
    maskTitle.beginFill(0xffffff, 1);
    maskTitle.drawRoundedRect(-titleMaskWidth / 2, 104, titleMaskWidth, 40, 10);
    maskTitle.endFill();
    achievementMask.addChild(maskTitle);

    if (subtitle.text) {
      const maskSubtitle = new Graphics();
      const subtitleMaskWidth = Math.max(170, subtitle.width + 26);
      maskSubtitle.beginFill(0xffffff, 1);
      maskSubtitle.drawRoundedRect(-subtitleMaskWidth / 2, 146, subtitleMaskWidth, 24, 8);
      maskSubtitle.endFill();
      achievementMask.addChild(maskSubtitle);
    }

    // Glitch effects dissolve the achievement silhouette.
    scanline.mask = achievementMask;
    noiseDots.mask = achievementMask;
    glitchBands.mask = achievementMask;
    interferenceStrips.mask = achievementMask;
    signalStatic.mask = achievementMask;
    cutPulse.mask = achievementMask;

    const labelGhostR = new Text(label.text, {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 1.8,
      fill: 0xff5d5d,
      align: 'center',
    });
    labelGhostR.anchor.set(0.5);
    labelGhostR.y = 88;
    labelGhostR.alpha = 0;
    medalRoot.addChild(labelGhostR);

    const labelGhostC = new Text(label.text, {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 1.8,
      fill: 0x6fd7ff,
      align: 'center',
    });
    labelGhostC.anchor.set(0.5);
    labelGhostC.y = 88;
    labelGhostC.alpha = 0;
    medalRoot.addChild(labelGhostC);

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

        const revealT = clamp(elapsed / attackEndMs, 0, 1);
        const settleT = clamp((elapsed - settleStartMs) / settleDurationMs, 0, 1);
        const sweepT = clamp((elapsed - sweepStartMs) / sweepDurationMs, 0, 1);
        const fadeOutT = clamp((elapsed - fadeStartMs) / fadeDurationMs, 0, 1);
        const signalCutT = clamp((elapsed - signalCutStartMs) / signalDurationMs, 0, 1);
        const preSignalLeadMs = useAudioTimeline ? fromAudio(110) : 90;
        const preSignalT = clamp((elapsed - (signalCutStartMs - preSignalLeadMs)) / preSignalLeadMs, 0, 1);
        const inSignalCut = signalCutT > 0.01;
        const tailFadeT = clamp((elapsed - tailStartMs) / Math.max(1, durationMs - tailStartMs), 0, 1);

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
          ? Math.sin((elapsed - signalCutStartMs) * 0.55) * 0.5 + 0.5
          : 0;
        const signalNoiseFloor = inSignalCut
          ? 0.11 + signalRush * 0.05
          : 0.018 + preSignalT * 0.045;

        tint.alpha =
          lerp(0, rarity === 'legendary' ? 0.12 : rarity === 'epic' ? 0.1 : 0.04, revealT) *
          (1 - fadeOutT);
        tint.alpha += inSignalCut ? signalStrength * (0.02 + signalRush * 0.03) : 0;
        vignette.alpha = lerp(0, vignetteTarget, easeOutCubic(revealT)) * (1 - fadeOutT);
        scanline.alpha = (signalNoiseFloor * 1.15 + signalStrength * 0.64) * (1 - fadeOutT);
        noiseDots.alpha = (signalNoiseFloor * 1.1 + signalStrength * 0.56) * (1 - fadeOutT);
        if (inSignalCut) {
          const roll = elapsed - signalCutStartMs;
          scanline.y = ((roll * 0.95) % 7) - 3.5;
          noiseDots.x = Math.sin(roll * 1.4) * 3.2;
        } else {
          scanline.y = 0;
          noiseDots.x = 0;
        }
        flash.alpha =
          flashAlpha *
          (1 - easeOutCubic(clamp(elapsed / Math.max(120, attackEndMs * 0.85), 0, 1))) *
          (1 - fadeOutT);
        if (profile.doubleBurst && elapsed > secondFlashStartMs && elapsed < secondFlashEndMs) {
          flash.alpha += 0.08 * Math.sin(((elapsed - secondFlashStartMs) / (secondFlashEndMs - secondFlashStartMs)) * Math.PI);
        }

        medalRoot.alpha =
          lerp(0, 1, easeOutCubic(revealT)) *
          (1 - fadeOutT) *
          (1 - tailFadeT * 0.24) *
          (1 - disappearEase);
        const peakScale = profile.settleScale;
        const baseScale =
          settleT > 0 ? lerp(peakScale, 1, easeOutCubic(settleT)) : lerp(0.62, peakScale, revealT);
        const tearScaleX = 1 + signalStrength * 0.011;
        medalRoot.scale.set(baseScale * tearScaleX, baseScale);
        medalRoot.y = lerp(medalY + profile.entryOffsetY, medalY, easeOutCubic(revealT));
        const signalKickX =
          -6.5 * signalSpikeA + 5.2 * signalSpikeB - 3.8 * signalSpikeC + 2.7 * signalSpikeD;
        medalRoot.x =
          centerX +
          Math.sin(elapsed / 45) * shakePx * (1 - revealT) * (1 - fadeOutT) +
          signalKickX;
        achievementMask.x = medalRoot.x;
        achievementMask.y = medalRoot.y;
        achievementMask.scale.set(medalRoot.scale.x, medalRoot.scale.y);

        glowSweep.alpha = sweepT < 1 ? 0.46 * Math.sin(Math.PI * sweepT) : 0;
        glowSweep.x = lerp(-180, 180, easeInOutCubic(sweepT));

        if (cameraPunch > 0) {
          const punchDecay = 1 - clamp((elapsed - 35) / 420, 0, 1);
          cameraRig.x =
            Math.sin(elapsed / 15.5) * cameraPunch * punchDecay +
            Math.cos(elapsed / 23) * cameraPunch * 0.2 * punchDecay;
          cameraRig.y = Math.cos(elapsed / 17.5) * cameraPunch * 0.65 * punchDecay;
          if (inSignalCut) {
            cameraRig.x *= 0.15;
            cameraRig.y *= 0.15;
          }
        }

        if (shockwaveEnabled) {
          const shockT = clamp((elapsed - shockStartMs) / shockDurationMs, 0, 1);
          shockwave.alpha = 0.8 * (1 - shockT) * (1 - fadeOutT);
          shockwave.scale.set(1 + shockT * 2.4);
        }
        if (shockwaveEnabled && profile.doubleBurst) {
          const shock2T = clamp((elapsed - shock2StartMs) / shock2DurationMs, 0, 1);
          shockwave2.alpha = 0.7 * (1 - shock2T) * (1 - fadeOutT);
          shockwave2.scale.set(1 + shock2T * 2.9);
        }
        if (rarity === 'epic' || rarity === 'legendary') {
          aura.alpha = (0.35 + Math.sin(elapsed / 120) * 0.1) * (1 - fadeOutT);
          const auraPulse = Math.sin(elapsed / 140) * (rarity === 'legendary' ? 0.08 : 0.05);
          aura.scale.set(inSignalCut ? 1 : 1 + auraPulse);
        }

        const tailTextFade = 1 - tailFadeT * 0.32;
        const hardDisappear = 1 - disappearEase;
        label.alpha = 0.9 * (1 - fadeOutT) * tailTextFade * hardDisappear;
        title.alpha =
          (inSignalCut ? 0.92 : 0.9 + Math.sin(elapsed / 160) * 0.06) *
          (1 - fadeOutT) *
          tailTextFade *
          hardDisappear;
        subtitle.alpha = subtitle.text
          ? (inSignalCut ? 0.76 : 0.75 + Math.sin(elapsed / 190) * 0.08) *
            (1 - fadeOutT) *
            tailTextFade *
            hardDisappear
          : 0;

        const rgbSplit = signalStrength * 7;
        titleGhostR.alpha = signalStrength * 0.78 * (1 - fadeOutT) * hardDisappear;
        titleGhostC.alpha = signalStrength * 0.78 * (1 - fadeOutT) * hardDisappear;
        titleGhostR.x = -rgbSplit - signalSpikeC * 2;
        titleGhostC.x = rgbSplit + signalSpikeB * 2;
        titleGhostR.y = 126 + signalSpikeB * 0.8;
        titleGhostC.y = 126 - signalSpikeC * 0.8;

        labelGhostR.alpha = signalStrength * 0.62 * (1 - fadeOutT) * hardDisappear;
        labelGhostC.alpha = signalStrength * 0.62 * (1 - fadeOutT) * hardDisappear;
        labelGhostR.x = -rgbSplit * 0.74;
        labelGhostC.x = rgbSplit * 0.74;
        labelGhostR.y = 88 + signalSpikeB * 0.5;
        labelGhostC.y = 88 - signalSpikeC * 0.5;

        interferenceStrips.clear();
        interferenceStrips.alpha = 0;
        if (signalStrength > 0.03 || preSignalT > 0.2) {
          const stripFrame = Math.floor((elapsed - signalCutStartMs) / 7);
          const stripCount = Math.max(12, Math.round(14 + signalStrength * 26 + preSignalT * 14));
          const primeY = glitchBlockY + (0.18 + hash01(stripFrame * 17 + 3) * 0.64) * glitchBlockHeight;
          const primeH = lerp(8, 22, hash01(stripFrame * 17 + 4));
          const primeShift = lerp(-30, 30, hash01(stripFrame * 17 + 5));
          interferenceStrips.beginFill(0xffffff, 0.52 + signalStrength * 0.2);
          interferenceStrips.drawRect(glitchBlockX + primeShift, primeY, glitchBlockWidth, primeH);
          interferenceStrips.endFill();
          interferenceStrips.beginFill(0x000000, 0.38 + signalStrength * 0.16);
          interferenceStrips.drawRect(glitchBlockX - primeShift * 0.6, primeY + primeH * 0.55, glitchBlockWidth, primeH * 0.5);
          interferenceStrips.endFill();
          for (let i = 0; i < stripCount; i++) {
            const seed = stripFrame * 211 + i * 31;
            const y = glitchBlockY + hash01(seed + 1) * glitchBlockHeight;
            const h = lerp(1.1, 6.2, hash01(seed + 2));
            const w = lerp(glitchBlockWidth * 0.55, glitchBlockWidth, hash01(seed + 3));
            const dir = hash01(seed + 4) > 0.5 ? 1 : -1;
            const xJitter = dir * lerp(6, 34, hash01(seed + 5));
            const x = glitchBlockX + (glitchBlockWidth - w) / 2 + xJitter;
            const colorPick = hash01(seed + 6);
            const color =
              colorPick > 0.82 ? 0xffffff : colorPick > 0.63 ? 0xa7d4ff : colorPick > 0.44 ? 0xffe4b8 : 0x000000;
            const alpha = lerp(0.2, 0.58, hash01(seed + 7)) * (0.45 + signalStrength * 0.95);
            interferenceStrips.beginFill(color, alpha);
            interferenceStrips.drawRect(x, y, w, h);
            interferenceStrips.endFill();
          }
          interferenceStrips.alpha =
            Math.min(1, 0.56 + signalStrength * 0.95 + preSignalT * 0.3) *
            (1 - fadeOutT * 0.1);
        }

        signalStatic.clear();
        signalStatic.alpha = 0;
        if (signalStrength > 0.03 || preSignalT > 0.35) {
          const staticFrame = Math.floor((elapsed - signalCutStartMs) / 7);
          const preBoost = preSignalT > 0 ? preSignalT * 26 : 0;
          const staticCount = Math.max(90, Math.round(110 + signalStrength * 220 + preBoost));
          for (let i = 0; i < staticCount; i++) {
            const seed = staticFrame * 131 + i * 17;
            const stripe = hash01(seed + 1) > 0.58;
            const x = glitchBlockX + hash01(seed + 2) * glitchBlockWidth;
            const y = glitchBlockY + hash01(seed + 3) * glitchBlockHeight;
            const w = stripe
              ? lerp(glitchBlockWidth * 0.25, glitchBlockWidth * 0.98, hash01(seed + 4))
              : lerp(1.2, 9.5, hash01(seed + 4));
            const h = stripe
              ? lerp(1.2, 5.6, hash01(seed + 5))
              : lerp(0.9, 2.8, hash01(seed + 5));
            const colorRoll = hash01(seed + 6);
            const color =
              colorRoll > 0.86 ? 0xffffff : colorRoll > 0.68 ? 0xa7d4ff : colorRoll > 0.48 ? 0x000000 : 0xffdca8;
            const alpha = lerp(0.28, 0.82, hash01(seed + 7)) * (0.58 + signalStrength * 0.78);
            signalStatic.beginFill(color, alpha);
            signalStatic.drawRect(x, y, Math.min(w, glitchBlockWidth), h);
            signalStatic.endFill();
          }
          signalStatic.alpha =
            Math.min(1, 0.54 + signalStrength * 0.98 + preSignalT * 0.18) *
            (1 - fadeOutT * 0.16) *
            (1 - disappearEase * 0.15);
          if (!inSignalCut) {
            signalStatic.alpha += preSignalT * 0.18;
          }
        }

        glitchBands.alpha = signalStrength * (1 - fadeOutT * 0.12);
        glitchBands.clear();
        if (signalStrength > 0.03) {
          const glitchFrame = Math.floor((elapsed - signalCutStartMs) / 8);
          const bandCount = Math.max(2, Math.round(3 + signalStrength * 6));
          const majorSeed = glitchFrame * 53 + 7;
          const majorBandY = glitchBlockY + hash01(majorSeed + 1) * glitchBlockHeight;
          const majorBandH = lerp(6, 18, hash01(majorSeed + 2));
          const majorBandX = glitchBlockX + lerp(-18, 18, hash01(majorSeed + 3));
          const majorBandAlpha = 0.16 + signalStrength * 0.22;
          const majorBandColor = hash01(majorSeed + 4) > 0.5 ? 0xffffff : 0xa7d4ff;
          glitchBands.beginFill(majorBandColor, majorBandAlpha);
          glitchBands.drawRect(majorBandX, majorBandY, glitchBlockWidth, majorBandH);
          glitchBands.endFill();

          for (let i = 0; i < bandCount; i++) {
            const seed = glitchFrame * 37 + i * 19;
            const bandY = glitchBlockY + hash01(seed + 1) * glitchBlockHeight;
            const bandH = lerp(3, 8.5, hash01(seed + 2));
            const bandW = lerp(glitchBlockWidth * 0.62, glitchBlockWidth * 0.98, hash01(seed + 3));
            const bandX =
              glitchBlockX +
              (glitchBlockWidth - bandW) / 2 +
              signalKickX * lerp(0.18, 0.86, hash01(seed + 4)) +
              lerp(-6, 6, hash01(seed + 5));
            const alpha = lerp(0.08, 0.24, hash01(seed + 6)) * (0.42 + signalStrength * 0.82);
            const color = hash01(seed + 7) > 0.66 ? 0xa7d4ff : 0xffffff;
            glitchBands.beginFill(color, alpha);
            glitchBands.drawRect(bandX, bandY, bandW, bandH);
            glitchBands.endFill();
          }
        }

        const blackoutA = impactSpike(signalCutT, 0.54, 0.72);
        const blackoutB = impactSpike(signalCutT, 0.78, 1);
        cutPulse.alpha = Math.max(blackoutA * 0.85, blackoutB);

        const sparkFade = clamp((elapsed - shockStartMs) / (durationMs * 0.36), 0, 1);
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

        if (profile.doubleBurst && !didSecondBurst && elapsed > secondBurstMs) {
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
