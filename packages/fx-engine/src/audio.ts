import type {
  FxAudioHints,
  FxAudioService,
  FxAudioSource,
  FxEvent,
  FxMode,
  FxRarity,
} from './types';

const DEFAULT_ALIAS = 'fx-levelup-default';
const DEFAULT_SOUND_DURATION_MS = 4729;
const MASTER_VOLUME = 0.5;
const MAX_DYNAMIC_SLOTS = 8;

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

type PixiSoundLoadOptions = {
  url: string;
  preload?: boolean;
  loaded?: (err?: unknown) => void;
};

type PixiSoundPlayOptions = {
  speed?: number;
  volume?: number;
  singleInstance?: boolean;
};

type PixiSoundLike = {
  context: unknown;
  add: (alias: string, options: PixiSoundLoadOptions) => void;
  exists: (alias: string) => boolean;
  stop: (alias: string) => void;
  play: (alias: string, options?: PixiSoundPlayOptions) => unknown;
  duration: (alias: string) => number;
  remove: (alias: string) => void;
};

interface PendingPlay {
  rarity: FxRarity;
  mode: FxMode;
  event?: FxEvent;
}

interface SoundSlot {
  key: string;
  alias: string;
  urls: string[];
  initialDurationMs: number;
  durationMs: number;
  lastUsedAt: number;
  version: number;
  initialized: boolean;
  loading: boolean;
  unavailable: boolean;
  pendingPlay: PendingPlay | null;
}

export class WebAudioFxService implements FxAudioService {
  private destroyed = false;
  private unlocked = false;
  private sound: PixiSoundLike | null = null;
  private soundLoadPromise: Promise<PixiSoundLike | null> | null = null;
  private preferredExt: 'mp3' | 'wav';
  private readonly slots = new Map<string, SoundSlot>();
  private readonly defaultSlot: SoundSlot;
  private readonly maxDynamicSlots: number;

  constructor(maxDynamicSlots = MAX_DYNAMIC_SLOTS) {
    this.maxDynamicSlots = maxDynamicSlots;
    this.preferredExt = this.resolvePreferredExtension();
    this.defaultSlot = this.createSlot(
      DEFAULT_ALIAS,
      DEFAULT_ALIAS,
      this.buildSourceUrls(DEFAULT_SOUND_SOURCE),
      DEFAULT_SOUND_DURATION_MS,
    );
    this.slots.set(this.defaultSlot.key, this.defaultSlot);
  }

  unlock(): void {
    if (this.destroyed || typeof window === 'undefined') return;
    const sound = this.getSound();
    if (!sound) {
      void this.ensureSoundLoaded().then((loaded) => {
        if (!loaded) return;
        this.unlock();
      });
      return;
    }

    this.ensureSlot(this.defaultSlot, sound);
    for (const slot of this.slots.values()) {
      this.ensureSlot(slot, sound);
    }

    const ctx = sound.context as MaybeWebAudioContext;
    if (ctx.audioContext?.state === 'suspended') {
      void ctx.audioContext.resume();
    }
    if (typeof ctx.playEmptySound === 'function') {
      ctx.playEmptySound();
    }

    this.unlocked = true;
    for (const slot of this.slots.values()) {
      this.flushPending(slot, sound);
    }
  }

  playSting(rarity: FxRarity, mode: FxMode, event?: FxEvent): number {
    if (this.destroyed || mode === 'off') return 0;

    const slot = this.resolveSlotForEvent(event);
    const playbackRate = this.resolvePlaybackRate(rarity, event?.audio);
    const durationMs = Math.round(slot.durationMs / playbackRate);
    const sound = this.getSound();

    if (!sound) {
      slot.pendingPlay = { rarity, mode, event };
      void this.ensureSoundLoaded().then((loaded) => {
        if (!loaded) return;
        this.unlock();
      });
      return durationMs;
    }

    this.unlock();
    this.ensureSlot(slot, sound);
    const activeSlot = this.resolveActiveSlot(slot, sound);

    if (!activeSlot) {
      slot.pendingPlay = { rarity, mode, event };
      return durationMs;
    }

    this.playSlot(activeSlot, rarity, mode, sound, event?.audio);
    return Math.round(activeSlot.durationMs / playbackRate);
  }

  dispose(): void {
    this.destroyed = true;
    for (const slot of this.slots.values()) {
      this.disposeSlot(slot, this.sound);
    }
    this.slots.clear();
    this.sound = null;
    this.soundLoadPromise = null;
    this.unlocked = false;
  }

  private getSound(): PixiSoundLike | null {
    return this.sound;
  }

  private ensureSoundLoaded(): Promise<PixiSoundLike | null> {
    if (this.destroyed || typeof window === 'undefined') return Promise.resolve(null);
    if (this.sound) return Promise.resolve(this.sound);
    if (this.soundLoadPromise) return this.soundLoadPromise;

    this.soundLoadPromise = import('@pixi/sound')
      .then((module) => {
        if (this.destroyed) return null;
        const maybeSound = (module as { sound?: PixiSoundLike }).sound;
        if (!maybeSound) return null;
        this.sound = maybeSound;
        return this.sound;
      })
      .catch(() => null)
      .finally(() => {
        this.soundLoadPromise = null;
      });

    return this.soundLoadPromise;
  }

  private resolveSlotForEvent(event?: FxEvent): SoundSlot {
    const source = event?.audio?.source;
    if (!source) {
      this.touchSlot(this.defaultSlot);
      return this.defaultSlot;
    }

    const urls = this.buildSourceUrls(source);
    if (urls.length === 0) {
      this.touchSlot(this.defaultSlot);
      return this.defaultSlot;
    }

    const key = this.resolveSourceKey(source, urls);
    const existing = this.slots.get(key);
    if (existing) {
      const overrideDuration = this.normalizeDurationMs(source.durationMs);
      if (overrideDuration && !existing.initialized) {
        existing.initialDurationMs = overrideDuration;
        existing.durationMs = overrideDuration;
      }
      this.touchSlot(existing);
      return existing;
    }

    this.evictDynamicSlotIfNeeded();
    const initialDurationMs = this.normalizeDurationMs(source.durationMs) ?? DEFAULT_SOUND_DURATION_MS;
    const alias = `fx-levelup-${this.hashKey(key)}`;
    const slot = this.createSlot(key, alias, urls, initialDurationMs);
    this.touchSlot(slot);
    this.slots.set(key, slot);
    return slot;
  }

  private resolveActiveSlot(slot: SoundSlot, sound: PixiSoundLike): SoundSlot | null {
    if (slot.initialized && sound.exists(slot.alias)) return slot;
    return null;
  }

  private buildSourceUrls(source: FxAudioSource): string[] {
    const mp3 = typeof source.mp3 === 'string' ? source.mp3.trim() : '';
    const wav = typeof source.wav === 'string' ? source.wav.trim() : '';
    const ordered = this.preferredExt === 'wav' ? [wav, mp3] : [mp3, wav];
    return ordered.filter((url): url is string => url.length > 0);
  }

  private resolveSourceKey(source: FxAudioSource, urls: string[]): string {
    const cacheKey = typeof source.cacheKey === 'string' ? source.cacheKey.trim() : '';
    if (cacheKey.length > 0) return `source:${cacheKey}`;
    return `source:${urls.join('|')}`;
  }

  private createSlot(key: string, alias: string, urls: string[], initialDurationMs: number): SoundSlot {
    return {
      key,
      alias,
      urls,
      initialDurationMs,
      durationMs: initialDurationMs,
      lastUsedAt: Date.now(),
      version: 0,
      initialized: false,
      loading: false,
      unavailable: false,
      pendingPlay: null,
    };
  }

  private ensureSlot(slot: SoundSlot, sound: PixiSoundLike): void {
    if (this.destroyed) return;
    if (slot.loading || slot.initialized || slot.unavailable) return;

    if (sound.exists(slot.alias)) {
      slot.initialized = true;
      this.refreshDuration(slot, sound);
      this.flushPending(slot, sound);
      return;
    }

    slot.loading = true;
    this.loadSlot(slot, sound);
  }

  private loadSlot(slot: SoundSlot, sound: PixiSoundLike): void {
    if (this.destroyed) return;
    const [url] = slot.urls;
    if (!url) {
      slot.loading = false;
      slot.unavailable = true;
      slot.pendingPlay = null;
      return;
    }

    const version = ++slot.version;
    sound.add(slot.alias, {
      url,
      preload: true,
      loaded: (err) => {
        if (!this.isCurrentSlotLoad(slot, version)) {
          slot.loading = false;
          slot.pendingPlay = null;
          this.cleanupAlias(sound, slot.alias);
          return;
        }

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

        this.refreshDuration(slot, sound);
        this.flushPending(slot, sound);
      },
    });
  }

  private flushPending(slot: SoundSlot, sound: PixiSoundLike): void {
    if (!slot.pendingPlay || !this.unlocked) return;
    const pending = slot.pendingPlay;
    slot.pendingPlay = null;
    const activeSlot = slot.initialized ? slot : this.resolveActiveSlot(slot, sound);
    if (!activeSlot) return;
    this.playSlot(activeSlot, pending.rarity, pending.mode, sound, pending.event?.audio);
  }

  private playSlot(
    slot: SoundSlot,
    rarity: FxRarity,
    mode: FxMode,
    sound: PixiSoundLike,
    audioHints?: FxAudioHints,
  ): void {
    const playbackRate = this.resolvePlaybackRate(rarity, audioHints);
    const baseVolume = mode === 'lite' ? RARITY_VOLUME[rarity] * 0.75 : RARITY_VOLUME[rarity];
    const hintVolumeMultiplier = this.resolveMultiplier(audioHints?.volumeMultiplier, 1, 0, 2);
    const volume = this.clamp(baseVolume * MASTER_VOLUME * hintVolumeMultiplier, 0, 1);

    sound.stop(slot.alias);
    sound.play(slot.alias, {
      speed: playbackRate,
      volume,
      singleInstance: true,
    });

    this.touchSlot(slot);
    this.refreshDuration(slot, sound);
  }

  private refreshDuration(slot: SoundSlot, sound: PixiSoundLike): void {
    const seconds = sound.duration(slot.alias);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    slot.durationMs = Math.round(seconds * 1000);
  }

  private resolvePlaybackRate(rarity: FxRarity, audioHints?: FxAudioHints): number {
    const baseRate = RARITY_PLAYBACK_RATE[rarity];
    const hintRateMultiplier = this.resolveMultiplier(audioHints?.playbackRateMultiplier, 1, 0.7, 1.4);
    return this.clamp(baseRate * hintRateMultiplier, 0.68, 1.4);
  }

  private resolveMultiplier(value: unknown, fallback: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return this.clamp(value, min, max);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private disposeSlot(slot: SoundSlot, sound: PixiSoundLike | null): void {
    slot.version += 1;

    if (slot.loading) {
      if (sound) {
        this.cleanupAlias(sound, slot.alias);
      }
      slot.pendingPlay = null;
      slot.initialized = false;
      slot.unavailable = true;
      slot.durationMs = slot.initialDurationMs;
      return;
    }

    if (sound && sound.exists(slot.alias)) {
      sound.stop(slot.alias);
      sound.remove(slot.alias);
    }
    slot.pendingPlay = null;
    slot.initialized = false;
    slot.loading = false;
    slot.unavailable = false;
    slot.durationMs = slot.initialDurationMs;
  }

  private evictDynamicSlotIfNeeded(): void {
    const dynamicSlots = Array.from(this.slots.values()).filter(
      (slot) => slot.key !== this.defaultSlot.key,
    );
    if (dynamicSlots.length < this.maxDynamicSlots) return;

    const candidates = dynamicSlots.filter((slot) => !slot.loading && !slot.pendingPlay);
    if (candidates.length === 0) return;

    const victim = candidates.sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
    if (!victim) return;

    this.disposeSlot(victim, this.sound);
    this.slots.delete(victim.key);
  }

  private touchSlot(slot: SoundSlot): void {
    slot.lastUsedAt = Date.now();
  }

  private isCurrentSlotLoad(slot: SoundSlot, version: number): boolean {
    return this.slots.get(slot.key) === slot && slot.version === version;
  }

  private cleanupAlias(sound: PixiSoundLike, alias: string): void {
    if (!sound.exists(alias)) return;
    sound.stop(alias);
    sound.remove(alias);
  }

  private normalizeDurationMs(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.round(this.clamp(value, 250, 20_000));
  }

  private hashKey(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
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
