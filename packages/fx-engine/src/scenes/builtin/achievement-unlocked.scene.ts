import type { AchievementFxEvent, FxRarity } from '../../types';
import type { FxSceneDefinition } from '../contracts';

export const achievementUnlockedScene: FxSceneDefinition<'achievement.unlocked'> = {
  id: 'achievement.unlocked',
  supports: () => true,
  create: (event: AchievementFxEvent, rarity: FxRarity) => ({
    sceneId: 'achievement.unlocked',
    rarity,
    payload: {
      ...event,
      rarity,
    },
  }),
};
