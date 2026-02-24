export type FxMode = 'off' | 'lite' | 'epic';

export type FxRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type FxEventType =
  | 'achievement.unlocked'
  | 'rank.promoted'
  | 'weapon.unlocked';

interface FxEventBase {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: string;
  rarity?: FxRarity;
  metadata?: Record<string, unknown>;
}

export interface AchievementFxEvent extends FxEventBase {
  type?: FxEventType;
}

export interface RankPromotedFxEvent extends FxEventBase {
  type: 'rank.promoted';
  rankTitle?: string;
  rankLevel?: number;
}

export interface WeaponUnlockedFxEvent extends FxEventBase {
  type: 'weapon.unlocked';
  weaponName?: string;
  weaponClass?: string;
}

export type FxEvent = AchievementFxEvent | RankPromotedFxEvent | WeaponUnlockedFxEvent;

export interface FxRenderOptions {
  mode: FxMode;
  reducedMotion: boolean;
  durationMs?: number;
}

export interface FxRenderer {
  playAchievement(event: FxEvent, options: FxRenderOptions): Promise<void>;
  dispose(): void;
}

export interface FxAudioService {
  unlock(): void;
  playSting(rarity: FxRarity, mode: FxMode): number;
  dispose(): void;
}

export interface FxController {
  showAchievement(event: FxEvent): void;
  setMode(mode: FxMode): void;
  setSafeMoment(value: boolean): void;
  unlockAudio(): void;
}
