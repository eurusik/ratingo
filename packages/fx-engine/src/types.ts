export type FxMode = 'off' | 'lite' | 'epic';
export type FxPreset = 'none' | 'ratingo-default';

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
  [key: string]: unknown;
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

export interface FxScenePlayerContext {
  app: unknown;
}

export type FxScenePlayer<TPayload extends FxEvent = FxEvent> = (
  event: TPayload,
  options: FxRenderOptions,
  context: FxScenePlayerContext,
) => Promise<void>;

export type FxPayloadSchema<TPayload extends FxEvent = FxEvent> = (
  payload: FxEvent,
) => payload is TPayload;

export interface FxSceneRegistration<TPayload extends FxEvent = FxEvent> {
  id: string;
  priority?: number;
  supports(event: FxEvent): boolean;
  create(event: FxEvent, rarity: FxRarity): {
    sceneId: string;
    rarity: FxRarity;
    payload: TPayload;
  };
  schema?: FxPayloadSchema<TPayload>;
}

export interface FxSceneManifest<TPayload extends FxEvent = FxEvent>
  extends FxSceneRegistration<TPayload> {
  player?: FxScenePlayer<TPayload>;
}

export interface FxRenderer {
  playAchievement(event: FxEvent, options: FxRenderOptions): Promise<void>;
  registerScenePlayer?<TPayload extends FxEvent = FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload>,
    schema?: FxPayloadSchema<TPayload>,
  ): void;
  dispose(): void;
}

export interface FxAudioService {
  unlock(): void;
  playSting(rarity: FxRarity, mode: FxMode): number;
  dispose(): void;
}

export interface FxController {
  showAchievement(event: FxEvent): void;
  registerScene<TPayload extends FxEvent = FxEvent>(scene: FxSceneRegistration<TPayload>): void;
  registerScenePlayer<TPayload extends FxEvent = FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload>,
    schema?: FxPayloadSchema<TPayload>,
  ): void;
  registerManifest<TPayload extends FxEvent = FxEvent>(manifest: FxSceneManifest<TPayload>): void;
  setMode(mode: FxMode): void;
  setSafeMoment(value: boolean): void;
  unlockAudio(): void;
}
