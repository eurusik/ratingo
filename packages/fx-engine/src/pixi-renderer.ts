import { Application, type Sprite } from 'pixi.js';
import {
  createIconResolver,
  type IconResolver,
} from './renderer/pixi/icon-texture';
import type {
  FxEvent,
  FxPayloadSchema,
  FxRegisteredIconSource,
  FxRenderOptions,
  FxRenderer,
  FxScenePlayer,
  FxScenePlayerContext,
} from './types';
import { FX_INTERNAL_SCENE_ID_KEY } from './runtime/internal-metadata';

const DEFAULT_SCENE_ID = 'achievement.unlocked';
export type PixiScenePlayerContext = FxScenePlayerContext<Application, Sprite>;

interface RegisteredScenePlayer {
  player: FxScenePlayer<FxEvent, PixiScenePlayerContext>;
  schema?: FxPayloadSchema;
}

export class PixiFxRenderer implements FxRenderer<PixiScenePlayerContext> {
  private app: Application | null = null;
  private disabled = false;
  private readonly scenePlayers = new Map<string, RegisteredScenePlayer>();
  private readonly iconResolver: IconResolver;
  private readonly activeAbortControllers = new Set<AbortController>();

  constructor(private readonly host: HTMLElement) {
    this.iconResolver = createIconResolver();
  }

  registerScenePlayer<TPayload extends FxEvent = FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload, PixiScenePlayerContext>,
    schema?: FxPayloadSchema<TPayload>,
  ): void {
    this.scenePlayers.set(sceneId, {
      player: player as FxScenePlayer<FxEvent, PixiScenePlayerContext>,
      schema: schema as FxPayloadSchema | undefined,
    });
  }

  registerIcon(key: string, source: FxRegisteredIconSource): void {
    this.iconResolver.registerIcon(key, source);
  }

  registerIcons(icons: Record<string, FxRegisteredIconSource>): void {
    this.iconResolver.registerIcons(icons);
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
    const abortController = new AbortController();
    this.activeAbortControllers.add(abortController);
    try {
      await registration.player(event, options, {
        app: this.app,
        abortSignal: abortController.signal,
        createIconSprite: (rarity, icon) => this.iconResolver.createIconSprite(rarity, icon),
      });
    } finally {
      this.activeAbortControllers.delete(abortController);
    }
  }

  dispose(): void {
    for (const controller of this.activeAbortControllers) {
      controller.abort();
    }
    this.activeAbortControllers.clear();

    if (!this.app) return;

    this.app.destroy(true, {
      children: true,
      texture: true,
      baseTexture: true,
    });
    this.app = null;
    this.iconResolver.dispose();
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
    const metadataSceneId = event.metadata?.[FX_INTERNAL_SCENE_ID_KEY];
    if (typeof metadataSceneId === 'string') return metadataSceneId;
    if (typeof event.type === 'string') return event.type;
    return DEFAULT_SCENE_ID;
  }
}
