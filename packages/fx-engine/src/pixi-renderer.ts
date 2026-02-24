import { Application } from 'pixi.js';
import { playAchievementUnlockedScene } from './renderer/pixi/scenes/play-achievement-unlocked-scene';
import type { FxEvent, FxRenderOptions, FxRenderer } from './types';

export class PixiFxRenderer implements FxRenderer {
  private app: Application | null = null;
  private disabled = false;

  constructor(private readonly host: HTMLElement) {}

  async playAchievement(event: FxEvent, options: FxRenderOptions): Promise<void> {
    if (this.disabled || options.mode === 'off') return;

    const ready = this.ensureApp();
    if (!ready || !this.app) return;

    await playAchievementUnlockedScene(this.app, event, options);
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
