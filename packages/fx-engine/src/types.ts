export type FxMode = 'off' | 'lite' | 'epic';

export type FxRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementFxEvent {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: string;
  rarity?: FxRarity;
}

export interface FxRenderOptions {
  mode: FxMode;
  reducedMotion: boolean;
}

export interface FxRenderer {
  playAchievement(event: AchievementFxEvent, options: FxRenderOptions): Promise<void>;
  dispose(): void;
}

export interface FxAudioService {
  unlock(): void;
  playSting(rarity: FxRarity, mode: FxMode): void;
  dispose(): void;
}

export interface FxController {
  showAchievement(event: AchievementFxEvent): void;
  setMode(mode: FxMode): void;
  setSafeMoment(value: boolean): void;
  unlockAudio(): void;
}
