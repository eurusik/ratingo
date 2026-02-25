# @ratingo/fx-engine

Pixi-based FX engine for short, high-impact gamification moments:

- achievement unlocked
- rank promoted

This package gives you:

- a queue-driven engine (`FxEngine`)
- a scene registry and typed scene contracts
- a Pixi renderer with icon and audio support
- React integration (`FxProvider`, `useFx`)

## What To Use

- Use `createWebFxEngine(...)` for vanilla/imperative integration.
- Use `FxProvider` + `useFx()` for React/Next.js integration.
- Use `registerManifest(...)` for new scenarios (recommended).

## Quick Start (React)

```tsx
'use client';

import { FxProvider, useFx } from '@ratingo/fx-engine';

function DemoButton() {
  const fx = useFx();
  return (
    <button
      onClick={() => {
        fx.showAchievement({
          type: 'achievement.unlocked',
          title: '5-episode streak',
          subtitle: 'No skips this week',
          rarity: 'epic',
          icon: { type: 'builtin', key: 'ribbon' },
        });
      }}
    >
      Trigger FX
    </button>
  );
}

export default function App() {
  return (
    <FxProvider defaultMode="epic" preset="ratingo-default">
      <DemoButton />
    </FxProvider>
  );
}
```

## Quick Start (Vanilla)

```ts
import { createWebFxEngine } from '@ratingo/fx-engine';

const host = document.getElementById('fx-host');
if (!host) throw new Error('Missing #fx-host');

const fx = createWebFxEngine(host, {
  preset: 'ratingo-default',
  mode: 'epic',
  safeMoment: true,
});

fx.unlockAudio();
fx.showAchievement({
  title: 'Rank Up',
  rarity: 'rare',
});
```

## Lazy Integration (Next.js)

Use this if you do not want FX code in your startup bundle.

### 1) Create a client-only lazy wrapper

```tsx
'use client';

import dynamic from 'next/dynamic';

export const LazyFxProvider = dynamic(
  () => import('@ratingo/fx-engine').then((m) => m.FxProvider),
  { ssr: false },
);
```

### 2) Mount it only where FX is needed

```tsx
'use client';

import { LazyFxProvider } from './lazy-fx-provider';
import { DemoContent } from './demo-content';

export default function ClientPage() {
  return (
    <LazyFxProvider defaultMode="epic" preset="ratingo-default">
      <DemoContent />
    </LazyFxProvider>
  );
}
```

### 3) Keep imports local

- Do not import `FxProvider` in root `layout.tsx`.
- Do not import `@ratingo/fx-engine` in global modules loaded on every route.
- Import FX only in route/feature modules where the animation is actually used.

## Public API

### `createWebFxEngine(host, config)`

```ts
type CreateWebFxEngineConfig = {
  preset?: 'none' | 'ratingo-default';
  mode?: 'off' | 'lite' | 'epic';
  safeMoment?: boolean;
  reducedMotion?: boolean;
  dedupeWindowMs?: number;
  epicCooldownMs?: number;
  summaryThreshold?: number;
  sceneRegistry?: FxSceneRegistry;
  icons?: Record<string, FxRegisteredIconSource>;
};
```

Returns `FxEngine<PixiScenePlayerContext>`.

### `FxController` (`useFx()`)

```ts
interface FxController<TContext = PixiScenePlayerContext> {
  showAchievement(event: FxEvent): void;
  registerScene<TPayload extends FxEvent>(scene: FxSceneRegistration<TPayload>): void;
  registerScenePlayer<TPayload extends FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload, TContext>,
    schema?: FxPayloadSchema<TPayload>,
  ): void;
  registerManifest<TPayload extends FxEvent>(
    manifest: FxSceneManifest<TPayload, TContext>,
  ): void;
  registerIcon(key: string, source: FxRegisteredIconSource): void;
  registerIcons(icons: Record<string, FxRegisteredIconSource>): void;
  setMode(mode: FxMode): void;
  setSafeMoment(value: boolean): void;
  unlockAudio(): void;
}
```

### Main types

- `FxMode`: `'off' | 'lite' | 'epic'`
- `FxRarity`: `'common' | 'rare' | 'epic' | 'legendary'`
- `FxEvent`: base payload for triggers (`title`, `subtitle`, `rarity`, `icon`, `audio`, `metadata`)
- `PixiScenePlayerContext`:
  - `app: Application`
  - `abortSignal?: AbortSignal`
  - `createIconSprite?: (rarity, icon) => Promise<Sprite>`

## Built-in Preset

`preset: 'ratingo-default'` registers:

- scene registrations
- scene players
- payload schemas

Built-in scene ids:

- `achievement.unlocked`
- `rank.promoted`

`weapon.unlocked` exists in generic scene contracts, but is not registered by `ratingo-default` preset.

Disable built-ins:

```ts
createWebFxEngine(host, { preset: 'none' });
```

## Icons

### Event icon input

`icon` supports:

- string token (legacy), e.g. `'trophy'`
- `{ type: 'library', key: 'ratingo:streak-7' }`
- `{ type: 'builtin', key: 'star' | 'shield' | 'ribbon' | 'trophy' }`
- `{ type: 'lucide', name: 'award', cacheKey?: string }`
- `{ type: 'svg', svg: '<svg ... />', cacheKey?: string }`
- `{ type: 'url', url: 'https://.../icon.svg', cacheKey?: string }`

`lucide` icons are loaded lazily via dynamic import, so the full icon set is not pulled into the startup bundle.

### Register reusable icons

```ts
fx.registerIcons({
  'ratingo:streak-7': {
    type: 'lucide',
    name: 'flame',
    cacheKey: 'flame-v1',
  },
  'ratingo:badge-custom': {
    type: 'svg',
    cacheKey: 'streak-7-v1',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>',
  },
  'ratingo:elite': {
    type: 'builtin',
    key: 'trophy',
  },
});
```

## Audio override per event

```ts
fx.showAchievement({
  type: 'achievement.unlocked',
  title: 'Prestige Up',
  rarity: 'legendary',
  audio: {
    volumeMultiplier: 0.9,
    playbackRateMultiplier: 0.95,
    source: {
      mp3: '/sounds/prestige.mp3',
      wav: '/sounds/prestige.wav',
      durationMs: 3550,
      cacheKey: 'prestige-v1',
    },
  },
});
```

## Add New Scene (Recommended)

This is the clean path: one manifest = mapping + payload build + renderer.

### 1) Define payload type

```ts
import type { AchievementFxEvent } from '@ratingo/fx-engine';

type StreakPayload = AchievementFxEvent & {
  streakCount: number;
};
```

### 2) Define schema (runtime guard)

```ts
import { definePayloadSchema, type FxEvent } from '@ratingo/fx-engine';

const isStreakPayload = definePayloadSchema(
  (payload: FxEvent): payload is StreakPayload => {
    const streak = payload.metadata?.streakCount;
    return typeof payload.title === 'string' && typeof streak === 'number';
  },
);
```

### 3) Define manifest

```ts
import {
  defineSceneManifest,
  type PixiScenePlayerContext,
} from '@ratingo/fx-engine';
import { Container, Graphics, Text } from 'pixi.js';

export const streakManifest = defineSceneManifest<StreakPayload, PixiScenePlayerContext>({
  id: 'custom.streak.promotion',
  priority: 90,
  schema: isStreakPayload,
  supports: (event) =>
    event.type === 'achievement.unlocked' && typeof event.metadata?.streakCount === 'number',
  create: (event, rarity) => ({
    sceneId: 'custom.streak.promotion',
    rarity,
    payload: {
      ...event,
      rarity,
      streakCount: Number(event.metadata?.streakCount ?? 0),
    },
  }),
  player: async (event, _options, context) => {
    const root = new Container();
    context.app.stage.addChild(root);

    const card = new Graphics();
    card.beginFill(0x0f1720, 0.94);
    card.drawRoundedRect(-220, -80, 440, 160, 20);
    card.endFill();
    card.x = context.app.screen.width / 2;
    card.y = context.app.screen.height / 2;
    root.addChild(card);

    const title = new Text(`Streak x${event.streakCount}`, {
      fill: 0xe8eef8,
      fontSize: 36,
      fontWeight: '700',
    });
    title.anchor.set(0.5);
    title.x = card.x;
    title.y = card.y;
    root.addChild(title);

    const icon = context.createIconSprite
      ? await context.createIconSprite(event.rarity ?? 'common', event.icon)
      : null;
    if (icon) {
      icon.x = card.x;
      icon.y = card.y - 52;
      root.addChild(icon);
    }

    await new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = () => {
        if (context.abortSignal?.aborted) {
          context.app.ticker.remove(tick);
          root.destroy({ children: true });
          resolve();
          return;
        }

        const t = Math.min(1, (performance.now() - start) / 900);
        root.alpha = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;

        if (t >= 1) {
          context.app.ticker.remove(tick);
          root.destroy({ children: true });
          resolve();
        }
      };

      context.app.ticker.add(tick);
    });
  },
});
```

### 4) Register manifest

```ts
fx.registerManifest(streakManifest);
```

### 5) Trigger event

```ts
fx.showAchievement({
  type: 'achievement.unlocked',
  title: 'Weekly consistency',
  subtitle: '7 episodes in a row',
  rarity: 'epic',
  icon: { type: 'library', key: 'ratingo:streak-7' },
  metadata: { streakCount: 7 },
});

fx.showAchievement({
  type: 'achievement.unlocked',
  title: 'Ghost mode',
  rarity: 'rare',
  icon: { type: 'lucide', name: 'ghost' },
});
```

## Alternative: register scene + player separately

Use only when you explicitly want split registration.

```ts
fx.registerScene({
  id: 'custom.simple',
  priority: 40,
  supports: (event) => event.title.includes('Simple'),
  create: (event, rarity) => ({
    sceneId: 'custom.simple',
    rarity,
    payload: { ...event, rarity },
  }),
});

fx.registerScenePlayer('custom.simple', async (event, options, context) => {
  // custom renderer logic
});
```

## Runtime Behavior

Selection and playback pipeline:

1. `showAchievement(event)` is called.
2. Engine applies dedupe/cooldown policies.
3. Scene registry resolves by priority (descending) and `supports(event)`.
4. Scene `create(...)` builds payload.
5. Renderer resolves player by `sceneId` (fallback: `achievement.unlocked`).
6. Audio and scene play with shared timing (`durationMs`).

## Runtime limits and safety

- Dynamic audio slot cache is bounded (LRU-like eviction, default `8` dynamic slots).
- Default sound slot is never evicted.
- Icon textures are cached per renderer instance and released on `dispose()`.
- Scene context carries `abortSignal`; active scenes are aborted on renderer dispose.
- Engine injects internal metadata key `metadata.__fx_scene_id` before render/audio call.

## React Provider notes

```tsx
<FxProvider
  defaultMode="epic"
  initialSafeMoment
  respectReducedMotion
  dedupeWindowMs={2000}
  epicCooldownMs={30000}
  preset="ratingo-default"
  icons={{
    'ratingo:streak-7': { type: 'url', url: 'https://cdn.example.com/fx/streak-7.svg' },
  }}
>
  {children}
</FxProvider>
```

- `respectReducedMotion` forces `lite` mode when user prefers reduced motion.
- Use `setSafeMoment(false)` during critical flows (payment/auth), then enable later.

## Local demo apps

- Standalone demo app: `npm run dev:fx-demo`

## Exports

Top-level exports include:

- runtime: `createWebFxEngine`, `FxEngine`, `FxProvider`, `useFx`
- scene helpers: `defineSceneManifest`, `definePayloadSchema`
- registry: `FxSceneRegistry`, `createSceneRegistry`, `createDefaultSceneRegistry`
- preset installer: `installRatingoDefaultPreset`
- context type: `PixiScenePlayerContext`
- all public domain types from `src/types.ts`
