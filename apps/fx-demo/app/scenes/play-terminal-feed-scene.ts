import type { FxEvent, FxRenderOptions, FxRarity, FxScenePlayer } from '@ratingo/fx-engine';
import { Application, Container, Graphics, Text } from 'pixi.js';

const TERMINAL_SCENE_ID = 'demo.terminal-feed';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function rarityColor(rarity: FxRarity): number {
  if (rarity === 'legendary') return 0xffa356;
  if (rarity === 'epic') return 0xba8cff;
  if (rarity === 'rare') return 0x63d4ff;
  return 0x8fa2bc;
}

function drawChamferedPanel(g: Graphics, w: number, h: number, c: number): void {
  g.clear();
  g.beginFill(0x07101d, 0.86);
  g.moveTo(c, 0);
  g.lineTo(w - c, 0);
  g.lineTo(w, c);
  g.lineTo(w, h - c);
  g.lineTo(w - c, h);
  g.lineTo(c, h);
  g.lineTo(0, h - c);
  g.lineTo(0, c);
  g.closePath();
  g.endFill();
}

export const demoTerminalFeedSceneId = TERMINAL_SCENE_ID;

export const playTerminalFeedScene: FxScenePlayer = async (
  event: FxEvent,
  options: FxRenderOptions,
  context,
) => {
  const app = context.app as Application | undefined;
  if (!app?.stage) return;

  const rarity = event.rarity ?? 'common';
  const color = rarityColor(rarity);
  const durationMs = clamp(options.durationMs ?? 2600, 1400, 5600);
  const attackMs = durationMs * 0.17;
  const holdEndMs = durationMs * 0.8;
  const outroMs = Math.max(160, durationMs - holdEndMs);

  const screenW = app.screen.width;
  const screenH = app.screen.height;

  const panelW = Math.min(680, screenW * 0.78);
  const panelH = Math.min(260, screenH * 0.34);
  const panelX = Math.max(18, screenW * 0.06);
  const panelY = Math.max(22, screenH - panelH - Math.max(30, screenH * 0.08));

  const root = new Container();
  app.stage.addChild(root);

  const veil = new Graphics();
  veil.beginFill(0x020610, 0.5);
  veil.drawRect(0, 0, screenW, screenH);
  veil.endFill();
  root.addChild(veil);

  const leftRail = new Graphics();
  leftRail.lineStyle(2, color, 0.45);
  leftRail.moveTo(panelX - 16, panelY - 26);
  leftRail.lineTo(panelX - 16, panelY + panelH + 16);
  leftRail.lineStyle(1, color, 0.3);
  leftRail.moveTo(panelX - 12, panelY - 6);
  leftRail.lineTo(panelX - 12, panelY + panelH + 4);
  root.addChild(leftRail);

  const panelRoot = new Container();
  panelRoot.position.set(panelX, panelY);
  root.addChild(panelRoot);

  const panel = new Graphics();
  drawChamferedPanel(panel, panelW, panelH, 18);
  panel.lineStyle(1.6, color, 0.62);
  panel.drawRect(6, 6, panelW - 12, panelH - 12);
  panelRoot.addChild(panel);

  const topStrip = new Graphics();
  topStrip.beginFill(color, 0.2);
  topStrip.drawRect(16, 16, panelW - 32, 10);
  topStrip.endFill();
  panelRoot.addChild(topStrip);

  const sweep = new Graphics();
  const sweepW = Math.max(150, panelW * 0.28);
  sweep.beginFill(color, 0.28);
  sweep.drawRect(0, 0, sweepW, 3);
  sweep.endFill();
  panelRoot.addChild(sweep);
  sweep.y = 20;

  const overline = new Text(`NODE://${rarity.toUpperCase()}_CHANNEL`, {
    fontFamily: 'IBM Plex Mono, Menlo, Consolas, monospace',
    fontSize: 16,
    letterSpacing: 1.5,
    fill: color,
  });
  overline.position.set(20, 42);
  panelRoot.addChild(overline);

  const titleRaw = (event.title || 'Terminal Feed').toUpperCase();
  const title = new Text('', {
    fontFamily: 'IBM Plex Mono, Menlo, Consolas, monospace',
    fontSize: Math.max(30, Math.min(52, panelW * 0.07)),
    fontWeight: '700',
    fill: 0xdbe6f6,
  });
  title.position.set(20, 84);
  panelRoot.addChild(title);

  const subtitleRaw = event.subtitle || 'Different scene style for API demos';
  const subtitle = new Text('', {
    fontFamily: 'IBM Plex Mono, Menlo, Consolas, monospace',
    fontSize: 20,
    fill: 0x91a1bc,
  });
  subtitle.position.set(20, 142);
  panelRoot.addChild(subtitle);

  const progressTrack = new Graphics();
  progressTrack.beginFill(0x1f2e47, 0.9);
  progressTrack.drawRect(20, panelH - 34, panelW - 40, 8);
  progressTrack.endFill();
  panelRoot.addChild(progressTrack);

  const progressFill = new Graphics();
  panelRoot.addChild(progressFill);

  const bars = new Graphics();
  panelRoot.addChild(bars);

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      const attackT = clamp(elapsed / attackMs, 0, 1);
      const outroT = elapsed <= holdEndMs ? 0 : clamp((elapsed - holdEndMs) / outroMs, 0, 1);
      const inEase = easeOutExpo(attackT);
      const outEase = easeInCubic(outroT);
      const alive = 1 - outEase;

      root.alpha = 0.18 + 0.82 * alive;
      veil.alpha = 0.44 * alive;

      panelRoot.x = lerp(panelX - panelW * 0.88, panelX, inEase) + lerp(0, panelW * 0.26, outEase);
      panelRoot.y = panelY + lerp(24, 0, inEase);
      panelRoot.skew.set(lerp(-0.22, 0, inEase), 0);
      panelRoot.scale.set(lerp(1.08, 1, inEase), lerp(0.92, 1, inEase) * lerp(1, 0.86, outEase));
      panelRoot.alpha = inEase * alive;

      const titleReveal = clamp((elapsed - attackMs * 0.32) / (attackMs * 0.9), 0, 1);
      const subtitleReveal = clamp((elapsed - attackMs * 0.65) / (attackMs * 0.9), 0, 1);
      const titleChars = Math.max(1, Math.floor(titleRaw.length * titleReveal));
      const subtitleChars = Math.max(0, Math.floor(subtitleRaw.length * subtitleReveal));
      title.text = titleRaw.slice(0, titleChars);
      subtitle.text = subtitleRaw.slice(0, subtitleChars);
      overline.alpha = (0.5 + Math.sin(elapsed / 120) * 0.2) * alive;

      const sweepT = ((elapsed % 520) / 520) * 1.35 - 0.15;
      sweep.x = lerp(-sweepW, panelW, sweepT);
      sweep.alpha = (0.18 + Math.sin(elapsed / 80) * 0.07) * alive;

      const progressT = clamp(elapsed / durationMs, 0, 1);
      progressFill.clear();
      progressFill.beginFill(color, 0.86 * alive);
      progressFill.drawRect(20, panelH - 34, (panelW - 40) * progressT, 8);
      progressFill.endFill();

      bars.clear();
      const barsCount = 20;
      const barsAreaW = Math.min(220, panelW * 0.34);
      const barsX = panelW - barsAreaW - 22;
      const barsY = panelH - 108;
      const barW = barsAreaW / barsCount - 2;
      for (let i = 0; i < barsCount; i += 1) {
        const phase = elapsed / 90 + i * 0.8;
        const amp = (Math.sin(phase) + 1) * 0.5;
        const h = 10 + amp * 46;
        bars.beginFill(color, (0.18 + amp * 0.52) * alive);
        bars.drawRect(barsX + i * (barW + 2), barsY + 56 - h, barW, h);
        bars.endFill();
      }

      if (elapsed >= durationMs) {
        app.ticker.remove(tick);
        root.destroy({ children: true });
        resolve();
      }
    };

    app.ticker.add(tick);
  });
};
