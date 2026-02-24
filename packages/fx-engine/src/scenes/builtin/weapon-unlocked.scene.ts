import type { FxEvent, FxRarity } from '../../types';
import type { FxSceneDefinition } from '../contracts';

export const weaponUnlockedScene: FxSceneDefinition<'weapon.unlocked'> = {
  id: 'weapon.unlocked',
  priority: 20,
  supports: (event: FxEvent) => event.type === 'weapon.unlocked',
  create: (event: FxEvent, rarity: FxRarity) => ({
    sceneId: 'weapon.unlocked',
    rarity,
    payload: {
      ...event,
      type: 'weapon.unlocked',
      subtitle: event.subtitle ?? 'NEW WEAPON UNLOCKED',
      icon: event.icon ?? 'ribbon',
      rarity,
    },
  }),
};
