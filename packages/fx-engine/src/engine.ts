import type {
  FxAudioService,
  FxEvent,
  FxMode,
  FxPayloadSchema,
  FxRarity,
  FxRegisteredIconSource,
  FxRenderer,
  FxSceneManifest,
  FxScenePlayer,
  FxScenePlayerContext,
  FxSceneRegistration,
} from './types';
import {
  buildDedupeKey,
  createSummaryAchievement,
  shouldDropByDedupe,
  shouldDropByEpicCooldown,
  shouldMergeQueue,
} from './core/policy/fx-policies';
import type { FxSceneDefinition, FxSceneEvent } from './scenes/contracts';
import { FxSceneRegistry, createSceneRegistry } from './scenes/registry';
import { renderScene } from './scenes/runtime';
import { FX_INTERNAL_SCENE_ID_KEY } from './runtime/internal-metadata';

const DEFAULT_DEDUPE_WINDOW_MS = 2000;
const DEFAULT_EPIC_COOLDOWN_MS = 30_000;
const DEFAULT_SUMMARY_THRESHOLD = 4;

export interface FxEngineConfig {
  mode?: FxMode;
  safeMoment?: boolean;
  reducedMotion?: boolean;
  dedupeWindowMs?: number;
  epicCooldownMs?: number;
  summaryThreshold?: number;
  sceneRegistry?: FxSceneRegistry;
}

interface QueueItem {
  scene: FxSceneEvent;
  queuedAt: number;
}

function withInternalSceneMetadata(scene: FxSceneEvent): FxSceneEvent {
  return {
    ...scene,
    payload: {
      ...scene.payload,
      metadata: {
        ...(scene.payload.metadata ?? {}),
        [FX_INTERNAL_SCENE_ID_KEY]: scene.sceneId,
      },
    },
  };
}

export class FxEngine<
  TRendererContext extends FxScenePlayerContext = FxScenePlayerContext,
> {
  private mode: FxMode;
  private safeMoment: boolean;
  private reducedMotion: boolean;
  private playing = false;
  private queue: QueueItem[] = [];
  private dedupeMap = new Map<string, number>();
  private lastEpicAt = 0;
  private dedupeWindowMs: number;
  private epicCooldownMs: number;
  private summaryThreshold: number;
  private sceneRegistry: FxSceneRegistry;

  constructor(
    private readonly renderer: FxRenderer<TRendererContext>,
    private readonly audio: FxAudioService,
    config: FxEngineConfig = {},
  ) {
    this.mode = config.mode ?? 'epic';
    this.safeMoment = config.safeMoment ?? true;
    this.reducedMotion = config.reducedMotion ?? false;
    this.dedupeWindowMs = config.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
    this.epicCooldownMs = config.epicCooldownMs ?? DEFAULT_EPIC_COOLDOWN_MS;
    this.summaryThreshold = config.summaryThreshold ?? DEFAULT_SUMMARY_THRESHOLD;
    this.sceneRegistry = config.sceneRegistry ?? createSceneRegistry();
  }

  setMode(mode: FxMode): void {
    this.mode = mode;
  }

  setSafeMoment(value: boolean): void {
    this.safeMoment = value;
    if (value) {
      void this.drain();
    }
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  unlockAudio(): void {
    this.audio.unlock();
  }

  registerScenePlayer<TPayload extends FxEvent = FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload, TRendererContext>,
    schema?: FxPayloadSchema<TPayload>,
  ): void {
    this.renderer.registerScenePlayer?.(sceneId, player, schema);
  }

  registerScene<TPayload extends FxEvent = FxEvent>(scene: FxSceneRegistration<TPayload>): void {
    this.sceneRegistry.register(scene as FxSceneDefinition<string, TPayload>);
  }

  registerManifest<TPayload extends FxEvent = FxEvent>(
    manifest: FxSceneManifest<TPayload, TRendererContext>,
  ): void {
    this.registerScene(manifest);
    if (!manifest.player) return;
    this.registerScenePlayer(manifest.id, manifest.player, manifest.schema);
  }

  registerIcon(key: string, source: FxRegisteredIconSource): void {
    this.renderer.registerIcon?.(key, source);
  }

  registerIcons(icons: Record<string, FxRegisteredIconSource>): void {
    this.renderer.registerIcons?.(icons);
  }

  showAchievement(event: FxEvent): void {
    if (this.mode === 'off') return;

    const rarity: FxRarity = event.rarity ?? 'common';
    const now = Date.now();
    const dedupeKey = buildDedupeKey(event, rarity);
    const lastSeen = this.dedupeMap.get(dedupeKey) ?? 0;

    if (shouldDropByDedupe(lastSeen, now, this.dedupeWindowMs)) return;
    if (shouldDropByEpicCooldown(rarity, now, this.lastEpicAt, this.epicCooldownMs)) {
      return;
    }

    this.dedupeMap.set(dedupeKey, now);
    if (rarity === 'epic' || rarity === 'legendary') {
      this.lastEpicAt = now;
    }

    const scene = this.sceneRegistry.resolve(event, rarity);
    if (!scene) return;

    const queuedScene = withInternalSceneMetadata(scene);
    this.queue.push({ scene: queuedScene, queuedAt: now });
    void this.drain();
  }

  dispose(): void {
    this.queue = [];
    this.renderer.dispose();
    this.audio.dispose();
  }

  private takeNext(): QueueItem | null {
    if (this.queue.length === 0) return null;
    if (shouldMergeQueue(this.queue.length, this.summaryThreshold)) {
      const mergedCount = this.queue.length;
      this.queue = [];
      const summary = createSummaryAchievement(mergedCount);
      const summaryRarity: FxRarity = summary.rarity ?? 'rare';
      const scene = this.sceneRegistry.resolve(summary, summaryRarity);
      if (!scene) return null;
      return {
        scene: withInternalSceneMetadata(scene),
        queuedAt: Date.now(),
      };
    }

    return this.queue.shift() ?? null;
  }

  private async drain(): Promise<void> {
    if (this.playing || !this.safeMoment || this.mode === 'off') return;
    const next = this.takeNext();
    if (!next) return;

    this.playing = true;
    try {
      const durationMs = this.audio.playSting(next.scene.rarity, this.mode, next.scene.payload);
      await renderScene(this.renderer, next.scene, {
        mode: this.mode,
        reducedMotion: this.reducedMotion,
        durationMs,
      });
    } finally {
      this.playing = false;
      if (this.queue.length > 0) {
        void this.drain();
      }
    }
  }
}
