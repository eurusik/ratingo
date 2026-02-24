import { sound } from '@pixi/sound';
import type { FxAudioService, FxMode, FxRarity } from './types';

const LEVELUP_ALIAS = 'fx-levelup';
const LEVELUP_MP3_URL = '/sounds/levelup.mp3';
const LEVELUP_WAV_URL = '/sounds/levelup.wav';
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
  private selectedUrl: string | null = null;

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

    const primaryUrl = this.selectedUrl ?? this.resolvePreferredUrl();
    const fallbackUrl = primaryUrl === LEVELUP_MP3_URL ? LEVELUP_WAV_URL : LEVELUP_MP3_URL;
    this.selectedUrl = primaryUrl;
    this.loading = true;
    this.loadSound(primaryUrl, fallbackUrl);
  }

  private refreshDuration(): void {
    const seconds = sound.duration(LEVELUP_ALIAS);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.durationMs = Math.round(seconds * 1000);
  }

  private loadSound(url: string, fallbackUrl: string | null): void {
    sound.add(LEVELUP_ALIAS, {
      url,
      preload: true,
      loaded: (err) => {
        if (err && fallbackUrl) {
          if (sound.exists(LEVELUP_ALIAS)) {
            sound.remove(LEVELUP_ALIAS);
          }
          this.selectedUrl = fallbackUrl;
          this.loadSound(fallbackUrl, null);
          return;
        }

        this.loading = false;
        this.initialized = !err && sound.exists(LEVELUP_ALIAS);
        if (this.initialized) {
          this.refreshDuration();
        }
      },
    });
  }

  private resolvePreferredUrl(): string {
    if (typeof window === 'undefined') return LEVELUP_WAV_URL;
    if (typeof window.Audio === 'undefined') return LEVELUP_MP3_URL;

    const probe = new window.Audio();
    const mp3Support = probe.canPlayType('audio/mpeg');
    if (mp3Support === 'probably' || mp3Support === 'maybe') {
      return LEVELUP_MP3_URL;
    }

    const wavSupport = probe.canPlayType('audio/wav');
    if (wavSupport === 'probably' || wavSupport === 'maybe') {
      return LEVELUP_WAV_URL;
    }

    return LEVELUP_MP3_URL;
  }
}
