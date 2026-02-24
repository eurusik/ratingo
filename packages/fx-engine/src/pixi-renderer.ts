import { Application } from 'pixi.js';
import type { FxEvent, FxPayloadSchema, FxRenderOptions, FxRenderer, FxScenePlayer } from './types';

const DEFAULT_SCENE_ID = 'achievement.unlocked';

interface RegisteredScenePlayer {
  player: FxScenePlayer;
  schema?: FxPayloadSchema;
}

export class PixiFxRenderer implements FxRenderer {
  private app: Application | null = null;
  private disabled = false;
  private readonly scenePlayers = new Map<string, RegisteredScenePlayer>();

  constructor(private readonly host: HTMLElement) {}

  registerScenePlayer<TPayload extends FxEvent = FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload>,
    schema?: FxPayloadSchema<TPayload>,
  ): void {
    this.scenePlayers.set(sceneId, {
      player: player as FxScenePlayer,
      schema: schema as FxPayloadSchema | undefined,
    });
  }

  async playAchievement(event: FxEvent, options: FxRenderOptions): Promise<void> {
    if (this.disabled || options.mode === 'off') return;

    const ready = this.ensureApp();
    if (!ready || !this.app) return;

    const sceneId = this.resolveSceneId(event);
    const registration =
      this.scenePlayers.get(sceneId) ?? this.scenePlayers.get(DEFAULT_SCENE_ID);
    if (!registration) return;
    if (registration.schema && !registration.schema(event)) return;
    await registration.player(event, options, { app: this.app });
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

  private resolveSceneId(event: FxEvent): string {
    const metadataSceneId = event.metadata?.__sceneId;
    if (typeof metadataSceneId === 'string') return metadataSceneId;
    if (typeof event.type === 'string') return event.type;
    return DEFAULT_SCENE_ID;
  }
}
