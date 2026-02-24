import type { AchievementFxEvent, FxAudioService, FxMode, FxRarity, FxRenderer } from './types';
import {
  buildDedupeKey,
  createSummaryAchievement,
  shouldDropByDedupe,
  shouldDropByEpicCooldown,
  shouldMergeQueue,
} from './core/policy/fx-policies';

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
}

interface QueueItem extends AchievementFxEvent {
  rarity: FxRarity;
  queuedAt: number;
}

export class FxEngine {
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

  constructor(
    private readonly renderer: FxRenderer,
    private readonly audio: FxAudioService,
    config: FxEngineConfig = {},
  ) {
    this.mode = config.mode ?? 'epic';
    this.safeMoment = config.safeMoment ?? true;
    this.reducedMotion = config.reducedMotion ?? false;
    this.dedupeWindowMs = config.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
    this.epicCooldownMs = config.epicCooldownMs ?? DEFAULT_EPIC_COOLDOWN_MS;
    this.summaryThreshold = config.summaryThreshold ?? DEFAULT_SUMMARY_THRESHOLD;
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

  showAchievement(event: AchievementFxEvent): void {
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

    this.queue.push({ ...event, rarity, queuedAt: now });
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
      return {
        title: summary.title,
        subtitle: summary.subtitle,
        rarity: 'rare',
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
      const durationMs = this.audio.playSting(next.rarity, this.mode);
      await this.renderer.playAchievement(next, {
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
