import { sound } from '@pixi/sound';
import type { FxAudioService, FxMode, FxRarity } from './types';

const DEFAULT_ALIAS = 'fx-levelup-default';
const DEFAULT_SOUND_DURATION_MS = 4729;
const MASTER_VOLUME = 0.5;

const DEFAULT_SOUND_SOURCE = {
  mp3: '/sounds/levelup.mp3',
  wav: '/sounds/levelup.wav',
} as const;

const RARITY_VOLUME: Record<FxRarity, number> = {
  common: 0.42,
  rare: 0.5,
  epic: 0.62,
  legendary: 0.72,
};

const RARITY_PLAYBACK_RATE: Record<FxRarity, number> = {
  common: 0.98,
  rare: 0.97,
  epic: 0.95,
  legendary: 0.93,
};

type MaybeWebAudioContext = {
  audioContext?: AudioContext;
  playEmptySound?: () => void;
};

interface PendingPlay {
  rarity: FxRarity;
  mode: FxMode;
}

interface SoundSlot {
  alias: string;
  urls: string[];
  durationMs: number;
  initialized: boolean;
  loading: boolean;
  unavailable: boolean;
  pendingPlay: PendingPlay | null;
}

export class WebAudioFxService implements FxAudioService {
  private destroyed = false;
  private unlocked = false;
  private preferredExt: 'mp3' | 'wav';
  private readonly defaultSlot: SoundSlot;

  constructor() {
    this.preferredExt = this.resolvePreferredExtension();
    this.defaultSlot = this.createSlot(DEFAULT_ALIAS, this.buildSourceUrls(DEFAULT_SOUND_SOURCE));
  }

  unlock(): void {
    if (this.destroyed || typeof window === 'undefined') return;
    this.ensureSlot(this.defaultSlot);

    const ctx = sound.context as MaybeWebAudioContext;
    if (ctx.audioContext?.state === 'suspended') {
      void ctx.audioContext.resume();
    }
    if (typeof ctx.playEmptySound === 'function') {
      ctx.playEmptySound();
    }

    this.unlocked = true;
    this.flushPending(this.defaultSlot);
  }

  playSting(rarity: FxRarity, mode: FxMode): number {
    if (this.destroyed || mode === 'off') return 0;

    this.unlock();

    this.ensureSlot(this.defaultSlot);

    const playbackRate = RARITY_PLAYBACK_RATE[rarity];
    const activeSlot = this.resolveActiveSlot();

    if (!activeSlot) {
      this.defaultSlot.pendingPlay = { rarity, mode };
      return Math.round(this.defaultSlot.durationMs / playbackRate);
    }

    this.playSlot(activeSlot, rarity, mode);
    return Math.round(activeSlot.durationMs / playbackRate);
  }

  dispose(): void {
    this.destroyed = true;
    this.disposeSlot(this.defaultSlot);
    this.unlocked = false;
  }

  private resolveActiveSlot(): SoundSlot | null {
    if (this.defaultSlot.initialized && sound.exists(this.defaultSlot.alias)) {
      return this.defaultSlot;
    }
    return null;
  }

  private buildSourceUrls(primary: { mp3: string; wav: string }): string[] {
    const primaryOrdered =
      this.preferredExt === 'wav' ? [primary.wav, primary.mp3] : [primary.mp3, primary.wav];
    return primaryOrdered;
  }

  private createSlot(alias: string, urls: string[]): SoundSlot {
    return {
      alias,
      urls,
      durationMs: DEFAULT_SOUND_DURATION_MS,
      initialized: false,
      loading: false,
      unavailable: false,
      pendingPlay: null,
    };
  }

  private ensureSlot(slot: SoundSlot): void {
    if (this.destroyed) return;
    if (slot.loading || slot.initialized || slot.unavailable) return;

    if (sound.exists(slot.alias)) {
      slot.initialized = true;
      this.refreshDuration(slot);
      this.flushPending(slot);
      return;
    }

    slot.loading = true;
    this.loadSlot(slot);
  }

  private loadSlot(slot: SoundSlot): void {
    if (this.destroyed) return;
    const [url] = slot.urls;
    if (!url) {
      slot.loading = false;
      slot.unavailable = true;
      slot.pendingPlay = null;
      return;
    }

    sound.add(slot.alias, {
      url,
      preload: true,
      loaded: (err) => {
        if (this.destroyed) {
          slot.loading = false;
          slot.pendingPlay = null;
          return;
        }

        if (err) {
          slot.loading = false;
          slot.unavailable = true;
          slot.pendingPlay = null;
          return;
        }

        slot.loading = false;
        slot.initialized = sound.exists(slot.alias);
        if (!slot.initialized) {
          slot.unavailable = true;
          slot.pendingPlay = null;
          return;
        }

        this.refreshDuration(slot);
        this.flushPending(slot);
      },
    });
  }

  private flushPending(slot: SoundSlot): void {
    if (!slot.pendingPlay || !this.unlocked) return;
    const pending = slot.pendingPlay;
    slot.pendingPlay = null;
    const activeSlot = slot.initialized ? slot : this.resolveActiveSlot();
    if (!activeSlot) return;
    this.playSlot(activeSlot, pending.rarity, pending.mode);
  }

  private playSlot(slot: SoundSlot, rarity: FxRarity, mode: FxMode): void {
    const playbackRate = RARITY_PLAYBACK_RATE[rarity];
    const baseVolume = mode === 'lite' ? RARITY_VOLUME[rarity] * 0.75 : RARITY_VOLUME[rarity];
    const volume = baseVolume * MASTER_VOLUME;

    sound.stop(slot.alias);
    sound.play(slot.alias, {
      speed: playbackRate,
      volume,
      singleInstance: true,
    });

    this.refreshDuration(slot);
  }

  private refreshDuration(slot: SoundSlot): void {
    const seconds = sound.duration(slot.alias);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    slot.durationMs = Math.round(seconds * 1000);
  }

  private disposeSlot(slot: SoundSlot): void {
    if (slot.loading) {
      slot.pendingPlay = null;
      slot.initialized = false;
      slot.unavailable = true;
      slot.durationMs = DEFAULT_SOUND_DURATION_MS;
      return;
    }

    if (sound.exists(slot.alias)) {
      sound.stop(slot.alias);
      sound.remove(slot.alias);
    }
    slot.pendingPlay = null;
    slot.initialized = false;
    slot.loading = false;
    slot.unavailable = false;
    slot.durationMs = DEFAULT_SOUND_DURATION_MS;
  }

  private resolvePreferredExtension(): 'mp3' | 'wav' {
    if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
      return 'mp3';
    }

    const probe = new window.Audio();
    const mp3Support = probe.canPlayType('audio/mpeg');
    if (mp3Support === 'probably' || mp3Support === 'maybe') {
      return 'mp3';
    }

    const wavSupport = probe.canPlayType('audio/wav');
    if (wavSupport === 'probably' || wavSupport === 'maybe') {
      return 'wav';
    }

    return 'mp3';
  }
}
