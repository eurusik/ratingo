import type { FxEvent, FxRarity } from '../../types';
import { achievementUnlockedPayloadSchema } from './payload-schemas';
import type { FxSceneDefinition } from '../contracts';

export const achievementUnlockedScene: FxSceneDefinition<'achievement.unlocked'> = {
  id: 'achievement.unlocked',
  priority: -100,
  schema: achievementUnlockedPayloadSchema,
  supports: (event: FxEvent) => !event.type || event.type === 'achievement.unlocked',
  create: (event: FxEvent, rarity: FxRarity) => ({
    sceneId: 'achievement.unlocked',
    rarity,
    payload: {
      ...event,
      type: 'achievement.unlocked',
      rarity,
    },
  }),
};
