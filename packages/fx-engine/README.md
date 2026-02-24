# @ratingo/fx-engine

Pixi-based FX engine for short gamification moments (achievement, promotion, unlock).

## Core Concepts

- `FxEvent`: input event from product logic.
- `FxSceneRegistration`: mapping rule `event -> scene payload`.
- `FxScenePlayer`: Pixi renderer for a concrete payload.
- `FxSceneManifest`: single contract that contains registration + optional player + optional payload schema.
- `FxPayloadSchema`: runtime type guard for payload validation.

Flow:

1. `showAchievement(event)` is called.
2. Scene registry picks the highest-priority scene where `supports(event)` is `true`.
3. Scene `create(...)` builds typed payload.
4. Renderer resolves player by `sceneId` and runs animation.

## Architecture

- `src/engine.ts`: queue, dedupe, cooldown, safe-moment orchestration
- `src/scenes/*`: scene contracts, registry, manifest helpers
- `src/pixi-renderer.ts`: Pixi runtime shell + scene player map
- `src/renderer/pixi/scenes/*`: concrete Pixi scene implementations
- `src/renderer/pixi/plugins/*`: reusable visual plugins (particles, glitch)
- `src/core/*`: pure logic (timeline, math, policy)
- `src/presets/*`: optional built-in behavior packs

## Built-in Scene IDs

- `achievement.unlocked`
- `rank.promoted`
- `weapon.unlocked`

## Presets

By default both `createWebFxEngine(...)` and `FxProvider` use `preset: 'ratingo-default'`.
This preset registers:

- built-in scene definitions
- built-in scene players
- built-in payload schemas

Disable all built-ins:

```ts
createWebFxEngine(host, { preset: 'none' });
```

## Public API

### createWebFxEngine

```ts
createWebFxEngine(host: HTMLElement, config?: {
  preset?: 'none' | 'ratingo-default';
  mode?: 'off' | 'lite' | 'epic';
  safeMoment?: boolean;
  reducedMotion?: boolean;
  dedupeWindowMs?: number;
  epicCooldownMs?: number;
  summaryThreshold?: number;
  sceneRegistry?: FxSceneRegistry;
});
```

### FxController (from `useFx()`)

```ts
showAchievement(event: FxEvent): void;
registerScene<TPayload extends FxEvent>(scene: FxSceneRegistration<TPayload>): void;
registerScenePlayer<TPayload extends FxEvent>(
  sceneId: string,
  player: FxScenePlayer<TPayload>,
  schema?: FxPayloadSchema<TPayload>,
): void;
registerManifest<TPayload extends FxEvent>(manifest: FxSceneManifest<TPayload>): void;
setMode(mode: FxMode): void;
setSafeMoment(value: boolean): void;
unlockAudio(): void;
```

### React Provider

```tsx
<FxProvider
  defaultMode="epic"
  initialSafeMoment
  respectReducedMotion
  dedupeWindowMs={2000}
  epicCooldownMs={30000}
  preset="ratingo-default"
>
  {children}
</FxProvider>
```

## Recommended Way to Add a New Animation

Use one manifest per scenario.

### 1. Define payload type + schema

```ts
import { definePayloadSchema, type FxEvent } from '@ratingo/fx-engine';

type KillstreakPayload = FxEvent & { killCount: number };

const isKillstreakPayload = definePayloadSchema(
  (payload): payload is KillstreakPayload =>
    typeof payload.title === 'string' && typeof payload.killCount === 'number',
);
```

### 2. Define manifest

```ts
import { defineSceneManifest } from '@ratingo/fx-engine';

const killstreakManifest = defineSceneManifest<KillstreakPayload>({
  id: 'custom.killstreak',
  priority: 80,
  schema: isKillstreakPayload,
  supports: (event) =>
    event.type === 'achievement.unlocked' && event.title.includes('Killstreak'),
  create: (event, rarity) => ({
    sceneId: 'custom.killstreak',
    rarity,
    payload: {
      ...event,
      killCount: Number(event.metadata?.killCount ?? 0),
      rarity,
    },
  }),
  player: async (event, options, context) => {
    const app = context.app as import('pixi.js').Application;
    // event.killCount is strongly typed here
    // render custom Pixi scene
  },
});
```

### 3. Register manifest

```ts
fx.registerManifest(killstreakManifest);
```

### 4. Trigger event

```ts
fx.showAchievement({
  type: 'achievement.unlocked',
  title: 'Killstreak x5',
  rarity: 'epic',
  metadata: { killCount: 5 },
});
```

## Alternative: Register Scene and Player Separately

```ts
fx.registerScene({
  id: 'custom.special',
  priority: 50,
  supports: (event) => event.title.includes('Special'),
  create: (event, rarity) => ({
    sceneId: 'custom.special',
    rarity,
    payload: { ...event, title: `CUSTOM ${event.title}`, rarity },
  }),
});

fx.registerScenePlayer('custom.special', async (event, options, context) => {
  const app = context.app as import('pixi.js').Application;
  // custom animation
});
```

## Resolution and Fallback Rules

- Scene selection: by `priority` descending.
- Schema check in registry: if schema fails, registry tries next matching scene.
- Player selection: by `sceneId`.
- Player fallback: if player not found, renderer tries `achievement.unlocked`.
- Schema check in renderer: if payload fails player schema, player is not executed.

## Built-in Preset Installer

If you create your own engine manually, you can still install built-ins explicitly:

```ts
import { installRatingoDefaultPreset } from '@ratingo/fx-engine';

installRatingoDefaultPreset(engine);
```
