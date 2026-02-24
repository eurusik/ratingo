# @ratingo/fx-engine

Pixi-based FX engine for short gamification moments (achievement, promotion, unlock).

## Architecture

- `src/engine.ts`: queue, dedupe, cooldown, safe-moment orchestration
- `src/scenes/*`: scene contracts, registry, runtime routing
- `src/pixi-renderer.ts`: Pixi runtime shell
- `src/renderer/pixi/scenes/*`: concrete Pixi scene implementations
- `src/renderer/pixi/plugins/*`: reusable visual plugins (particles, glitch)
- `src/core/*`: pure logic (timeline, math, policy)

## Built-in Scene IDs

- `achievement.unlocked`
- `rank.promoted`
- `weapon.unlocked`

## Register a custom scene

```ts
import { FxEngine } from '@ratingo/fx-engine';

engine.registerScene({
  id: 'custom.special',
  priority: 50,
  supports: (event) => event.title.includes('Special'),
  create: (event, rarity) => ({
    sceneId: 'custom.special',
    rarity,
    payload: {
      ...event,
      title: `CUSTOM ${event.title}`,
      rarity,
    },
  }),
});
```

`priority` is optional. Higher priority is resolved first.

## Trigger events

```ts
fx.showAchievement({
  type: 'rank.promoted',
  title: 'Colonel',
  rarity: 'epic',
});

fx.showAchievement({
  type: 'weapon.unlocked',
  title: 'M416',
  rarity: 'rare',
});
```
