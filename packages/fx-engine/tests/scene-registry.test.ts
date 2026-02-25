import { describe, expect, it } from '@jest/globals';
import type { AchievementFxEvent, FxEvent } from '../src/types';
import type { FxSceneDefinition } from '../src/scenes/contracts';
import { FxSceneRegistry, createDefaultSceneRegistry } from '../src/scenes/registry';

describe('FxSceneRegistry', () => {
  it('routes rank and weapon builtins by type', () => {
    const registry = createDefaultSceneRegistry();

    const rankScene = registry.resolve(
      {
        type: 'rank.promoted',
        title: 'Colonel',
      },
      'epic',
    );
    const weaponScene = registry.resolve(
      {
        type: 'weapon.unlocked',
        title: 'M416',
      },
      'rare',
    );

    expect(rankScene).not.toBeNull();
    expect(weaponScene).not.toBeNull();
    if (!rankScene || !weaponScene) return;

    expect(rankScene.sceneId).toBe('rank.promoted');
    expect(weaponScene.sceneId).toBe('weapon.unlocked');
  });

  it('uses default achievement scene', () => {
    const registry = createDefaultSceneRegistry();
    const event: AchievementFxEvent = { title: 'Rank Up' };

    const scene = registry.resolve(event, 'epic');
    expect(scene).not.toBeNull();
    if (!scene) return;

    expect(scene.sceneId).toBe('achievement.unlocked');
    expect(scene.rarity).toBe('epic');
    expect(scene.payload.rarity).toBe('epic');
  });

  it('selects custom scene when supported', () => {
    const registry = createDefaultSceneRegistry();
    const customScene: FxSceneDefinition<'achievement.unlocked'> = {
      id: 'achievement.unlocked',
      supports: (event) => typeof event.icon === 'string' && event.icon.includes('special'),
      create: (event, rarity) => ({
        sceneId: 'achievement.unlocked',
        rarity,
        payload: {
          ...event,
          title: `SPECIAL ${event.title}`,
          rarity,
        },
      }),
    };

    registry.register(customScene);
    const scene = registry.resolve(
      {
        title: 'Rank Up',
        icon: 'special-badge',
      },
      'legendary',
    );
    expect(scene).not.toBeNull();
    if (!scene) return;

    expect(scene.payload.title).toBe('SPECIAL Rank Up');
    expect(scene.payload.rarity).toBe('legendary');
  });

  it('lets custom scene id override fallback by priority', () => {
    const registry = createDefaultSceneRegistry();
    const customScene: FxSceneDefinition<'custom.special'> = {
      id: 'custom.special',
      priority: 10,
      supports: () => true,
      create: (event, rarity) => ({
        sceneId: 'custom.special',
        rarity,
        payload: {
          ...event,
          title: `CUSTOM ${event.title}`,
          rarity,
        },
      }),
    };

    registry.register(customScene);
    const scene = registry.resolve({ title: 'Fallback Candidate' }, 'common');
    expect(scene).not.toBeNull();
    if (!scene) return;

    expect(scene.sceneId).toBe('custom.special');
    expect(scene.payload.title).toBe('CUSTOM Fallback Candidate');
  });

  it('returns null when no scene supports event', () => {
    const registry = new FxSceneRegistry();
    const scene = registry.resolve({ title: 'No mapping' }, 'common');
    expect(scene).toBeNull();
  });

  it('rebuilds priority order after late scene registration', () => {
    const registry = new FxSceneRegistry();

    registry.register({
      id: 'custom.low',
      priority: 1,
      supports: () => true,
      create: (event, rarity) => ({
        sceneId: 'custom.low',
        rarity,
        payload: event,
      }),
    });

    const before = registry.resolve({ title: 'Order' }, 'common');
    expect(before?.sceneId).toBe('custom.low');

    registry.register({
      id: 'custom.high',
      priority: 100,
      supports: () => true,
      create: (event, rarity) => ({
        sceneId: 'custom.high',
        rarity,
        payload: event,
      }),
    });

    const after = registry.resolve({ title: 'Order' }, 'common');
    expect(after?.sceneId).toBe('custom.high');
  });

  it('falls back when custom schema rejects payload', () => {
    const registry = createDefaultSceneRegistry();

    registry.register({
      id: 'custom.invalid-schema',
      priority: 90,
      supports: () => true,
      schema: (_payload): _payload is FxEvent => false,
      create: (event, rarity) => ({
        sceneId: 'custom.invalid-schema',
        rarity,
        payload: {
          ...event,
          title: `BROKEN ${event.title}`,
          rarity,
        },
      }),
    });

    const scene = registry.resolve({ title: 'Rank Up' }, 'rare');
    expect(scene).not.toBeNull();
    if (!scene) return;

    expect(scene.sceneId).toBe('achievement.unlocked');
    expect(scene.payload.title).toBe('Rank Up');
  });
});
