import type { FxEvent, FxRarity } from '../../types';
import type { FxSceneDefinition } from '../contracts';

export const rankPromotedScene: FxSceneDefinition<'rank.promoted'> = {
  id: 'rank.promoted',
  priority: 20,
  supports: (event: FxEvent) => event.type === 'rank.promoted',
  create: (event: FxEvent, rarity: FxRarity) => ({
    sceneId: 'rank.promoted',
    rarity,
    payload: {
      ...event,
      type: 'rank.promoted',
      subtitle: event.subtitle ?? 'PROMOTION UNLOCKED',
      icon: event.icon ?? 'shield',
      rarity,
    },
  }),
};
