import type { FxEvent, FxRenderOptions, FxRarity, FxScenePlayer } from '@ratingo/fx-engine';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

const SCAN_SCENE_ID = 'demo.scan-impact';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function rarityTint(rarity: FxRarity): number {
  if (rarity === 'legendary') return 0xd7bc74;
  if (rarity === 'epic') return 0xa79bc7;
  if (rarity === 'rare') return 0x9cbad2;
  return 0xb0b2b9;
}

function rarityIcon(rarity: FxRarity): string {
  if (rarity === 'legendary') return '★';
  if (rarity === 'epic') return '◆';
  if (rarity === 'rare') return '⬢';
  return '●';
}

function resolveIconLabel(event: FxEvent, rarity: FxRarity): string {
  if (typeof event.icon === 'string') {
    const token = event.icon.trim();
    if (token.length > 0 && token.length <= 2) return token;
  }
  return rarityIcon(rarity);
}

export const demoScanImpactSceneId = SCAN_SCENE_ID;

export const playScanImpactScene: FxScenePlayer = async (
  event: FxEvent,
  options: FxRenderOptions,
  context,
) => {
  const app = context.app as Application | undefined;
  if (!app?.stage) return;

  const rarity = event.rarity ?? 'common';
  const tint = rarityTint(rarity);
  const durationMs = clamp(options.durationMs ?? 2400, 1300, 5200);
  const attackMs = durationMs * 0.18;
  const sustainEndMs = durationMs * 0.76;
  const outroMs = Math.max(160, durationMs - sustainEndMs);
  const scanLoopMs = Math.max(440, durationMs * 0.32);

  const width = app.screen.width;
  const height = app.screen.height;
  const centerX = width / 2;
  const centerY = height / 2 + Math.min(36, height * 0.06);
  const panelW = Math.min(780, width * 0.84);
  const panelH = Math.min(250, height * 0.32);
  const panelX = -panelW / 2;
  const panelY = -panelH / 2;

  const root = new Container();
  root.position.set(centerX, centerY);
  app.stage.addChild(root);

  const shadow = new Graphics();
  shadow.beginFill(0x000000, 0.42);
  shadow.drawRoundedRect(panelX + 16, panelY + 18, panelW, panelH, 34);
  shadow.endFill();
  root.addChild(shadow);

  const panel = new Graphics();
  panel.beginFill(0x0b1322, 0.9);
  panel.drawRoundedRect(panelX, panelY, panelW, panelH, 28);
  panel.endFill();
  panel.lineStyle(1.4, tint, 0.44);
  panel.drawRoundedRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2, 27);
  root.addChild(panel);

  const topBar = new Graphics();
  topBar.beginFill(tint, 0.2);
  topBar.drawRoundedRect(panelX + 28, panelY + 18, panelW - 56, 14, 8);
  topBar.endFill();
  root.addChild(topBar);

  const badge = new Graphics();
  badge.beginFill(0x111a2a, 0.96);
  badge.lineStyle(3, tint, 0.86);
  badge.drawCircle(0, panelY - 8, 68);
  badge.endFill();
  root.addChild(badge);

  const icon = new Text(resolveIconLabel(event, rarity), {
    fontFamily: 'Inter, Segoe UI, sans-serif',
    fontSize: 44,
    fontWeight: '700',
    fill: 0x151d2c,
  });
  icon.anchor.set(0.5);
  icon.position.set(0, panelY - 8);
  root.addChild(icon);

  const overline = new Text(`${rarity.toUpperCase()} SCAN`, {
    fontFamily: 'Inter, Segoe UI, sans-serif',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
    fill: tint,
  });
  overline.anchor.set(0.5);
  overline.position.set(0, panelY + panelH * 0.28);
  root.addChild(overline);

  const titleStyle = new TextStyle({
    fontFamily: 'Inter, Segoe UI, sans-serif',
    fontSize: Math.max(36, Math.min(64, panelW * 0.078)),
    fontWeight: '800',
    fill: 0xd7dde7,
    dropShadow: true,
    dropShadowAlpha: 0.36,
    dropShadowBlur: 12,
    dropShadowDistance: 0,
    dropShadowColor: '#000000',
  });

  const title = new Text(event.title || 'Scan Impact', titleStyle);
  title.anchor.set(0.5);
  title.position.set(0, panelY + panelH * 0.52);
  root.addChild(title);

  const subtitle = new Text(event.subtitle || 'Alternative test scene', {
    fontFamily: 'Inter, Segoe UI, sans-serif',
    fontSize: 24,
    fontWeight: '600',
    fill: 0x8d96a9,
  });
  subtitle.anchor.set(0.5);
  subtitle.position.set(0, panelY + panelH * 0.7);
  root.addChild(subtitle);

  const scanMask = new Graphics();
  scanMask.beginFill(0xffffff, 1);
  scanMask.drawRoundedRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16, 24);
  scanMask.endFill();
  root.addChild(scanMask);

  const scanBeam = new Graphics();
  const beamW = Math.max(180, panelW * 0.3);
  scanBeam.beginFill(0xffffff, 0.42);
  scanBeam.drawRoundedRect(0, panelY + panelH * 0.38, beamW, 7, 4);
  scanBeam.endFill();
  scanBeam.mask = scanMask;
  root.addChild(scanBeam);

  const pulseRing = new Graphics();
  root.addChild(pulseRing);

  const start = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = clamp(elapsed / durationMs, 0, 1);

      const attackT = clamp(elapsed / attackMs, 0, 1);
      const outroT = elapsed <= sustainEndMs ? 0 : clamp((elapsed - sustainEndMs) / outroMs, 0, 1);

      const attackEase = easeOutCubic(attackT);
      const outroEase = easeInCubic(outroT);
      const alive = 1 - outroEase;

      root.alpha = attackEase * alive;
      root.y = centerY + lerp(32, 0, attackEase) + lerp(0, -18, outroEase);
      root.scale.set(lerp(0.9, 1, attackEase), lerp(0.96, 1, attackEase) * lerp(1, 0.9, outroEase));

      panel.alpha = 0.9 * alive;
      topBar.alpha = 0.2 * alive;
      shadow.alpha = 0.42 * alive;
      badge.alpha = alive;
      icon.alpha = alive;

      const textAlpha = clamp((elapsed - attackMs * 0.58) / (attackMs * 0.8), 0, 1) * alive;
      overline.alpha = textAlpha;
      title.alpha = textAlpha;
      subtitle.alpha = clamp((elapsed - attackMs * 0.75) / (attackMs * 0.9), 0, 1) * alive;

      const scanProgress = ((elapsed % scanLoopMs) / scanLoopMs) * 1.2 - 0.1;
      scanBeam.alpha = (0.22 + Math.sin(elapsed / 120) * 0.08) * alive;
      scanBeam.x = lerp(panelX - beamW - 26, panelX + panelW + 26, scanProgress);

      pulseRing.clear();
      const ringBase = 76 + Math.sin(elapsed / 90) * 3;
      const ringGrow = ringBase + lerp(0, 44, outroEase);
      pulseRing.lineStyle(2, tint, 0.18 * alive);
      pulseRing.drawCircle(0, panelY - 8, ringGrow);

      if (elapsed >= durationMs) {
        app.ticker.remove(tick);
        root.destroy({ children: true });
        resolve();
      }
    };

    app.ticker.add(tick);
  });
};
