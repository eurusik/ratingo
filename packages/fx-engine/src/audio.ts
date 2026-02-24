import { sound } from '@pixi/sound';
import type { FxAudioService, FxMode, FxRarity } from './types';

const LEVELUP_ALIAS = 'fx-levelup';
const LEVELUP_SOUND_URL = '/sounds/levelup.wav';
const DEFAULT_SOUND_DURATION_MS = 4729;

const RARITY_VOLUME: Record<FxRarity, number> = {
  common: 0.42,
  rare: 0.5,
  epic: 0.62,
  legendary: 0.72,
};

type MaybeWebAudioContext = {
  audioContext?: AudioContext;
  playEmptySound?: () => void;
};

export class WebAudioFxService implements FxAudioService {
  private unlocked = false;
  private initialized = false;
  private loading = false;
  private durationMs = DEFAULT_SOUND_DURATION_MS;

  unlock(): void {
    if (typeof window === 'undefined') return;
    this.ensureSound();

    const ctx = sound.context as MaybeWebAudioContext;
    if (ctx.audioContext?.state === 'suspended') {
      void ctx.audioContext.resume();
    }
    if (typeof ctx.playEmptySound === 'function') {
      ctx.playEmptySound();
    }

    this.unlocked = true;
  }

  playSting(rarity: FxRarity, mode: FxMode): number {
    if (mode === 'off') return 0;

    this.unlock();
    this.ensureSound();
    if (!this.initialized || !sound.exists(LEVELUP_ALIAS)) {
      return this.durationMs;
    }

    const playbackRate = mode === 'lite' ? 1.08 : 1;
    const volume = mode === 'lite' ? RARITY_VOLUME[rarity] * 0.75 : RARITY_VOLUME[rarity];

    sound.stop(LEVELUP_ALIAS);
    sound.play(LEVELUP_ALIAS, {
      speed: playbackRate,
      volume,
      singleInstance: true,
    });

    this.refreshDuration();
    return Math.round(this.durationMs / playbackRate);
  }

  dispose(): void {
    if (sound.exists(LEVELUP_ALIAS)) {
      sound.stop(LEVELUP_ALIAS);
      sound.remove(LEVELUP_ALIAS);
    }
    this.unlocked = false;
    this.initialized = false;
    this.loading = false;
  }

  private ensureSound(): void {
    if (this.loading || this.initialized) return;

    if (sound.exists(LEVELUP_ALIAS)) {
      this.initialized = true;
      this.refreshDuration();
      return;
    }

    this.loading = true;
    sound.add(LEVELUP_ALIAS, {
      url: LEVELUP_SOUND_URL,
      preload: true,
      loaded: (err) => {
        this.loading = false;
        this.initialized = sound.exists(LEVELUP_ALIAS);
        if (err) {
          this.initialized = false;
        }
        if (this.initialized) {
          this.refreshDuration();
        }
      },
    });
  }

  private refreshDuration(): void {
    const seconds = sound.duration(LEVELUP_ALIAS);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.durationMs = Math.round(seconds * 1000);
  }
}
