'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FxEngine } from './engine';
import { noopAudio, noopRenderer } from './noop';
import { createWebFxEngine } from './create-web-fx-engine';
import type {
  FxController,
  FxEvent,
  FxMode,
  FxPayloadSchema,
  FxPreset,
  FxRegisteredIconSource,
  FxSceneManifest,
  FxScenePlayer,
  FxSceneRegistration,
} from './types';

interface FxProviderProps {
  children: ReactNode;
  defaultMode?: FxMode;
  initialSafeMoment?: boolean;
  respectReducedMotion?: boolean;
  epicCooldownMs?: number;
  dedupeWindowMs?: number;
  preset?: FxPreset;
  icons?: Record<string, FxRegisteredIconSource>;
}

const FxContext = createContext<FxController | null>(null);

export function FxProvider({
  children,
  defaultMode = 'epic',
  initialSafeMoment = true,
  respectReducedMotion = true,
  epicCooldownMs,
  dedupeWindowMs,
  preset = 'ratingo-default',
  icons,
}: FxProviderProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FxEngine>(new FxEngine(noopRenderer, noopAudio));
  const sceneRegistryRef = useRef(new Map<string, FxSceneRegistration<FxEvent>>());
  const scenePlayerRegistryRef = useRef(
    new Map<
      string,
      {
        player: FxScenePlayer<FxEvent>;
        schema?: FxPayloadSchema<FxEvent>;
      }
    >(),
  );
  const manifestRegistryRef = useRef(new Map<string, FxSceneManifest<FxEvent>>());
  const iconRegistryRef = useRef(new Map<string, FxRegisteredIconSource>());
  const [mode, setModeState] = useState<FxMode>(defaultMode);

  const applyRegistrations = useCallback((engine: FxEngine) => {
    for (const [key, source] of iconRegistryRef.current.entries()) {
      engine.registerIcon(key, source);
    }
    for (const scene of sceneRegistryRef.current.values()) {
      engine.registerScene(scene);
    }
    for (const [sceneId, registration] of scenePlayerRegistryRef.current.entries()) {
      engine.registerScenePlayer(sceneId, registration.player, registration.schema);
    }
    for (const manifest of manifestRegistryRef.current.values()) {
      engine.registerManifest(manifest);
    }
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;

    const initialReducedMotion =
      respectReducedMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const engine = createWebFxEngine(hostRef.current, {
      mode: defaultMode,
      safeMoment: initialSafeMoment,
      reducedMotion: initialReducedMotion,
      epicCooldownMs,
      dedupeWindowMs,
      preset,
      icons,
    });

    engineRef.current = engine;
    applyRegistrations(engine);

    const unlock = () => engine.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMedia = () => {
      if (!respectReducedMotion) {
        engine.setReducedMotion(false);
        return;
      }

      engine.setReducedMotion(media.matches);
      if (media.matches) {
        engine.setMode('lite');
        setModeState('lite');
      }
    };

    media.addEventListener('change', handleMedia);
    handleMedia();

    return () => {
      media.removeEventListener('change', handleMedia);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      engine.dispose();
      engineRef.current = new FxEngine(noopRenderer, noopAudio);
    };
  }, [
    applyRegistrations,
    defaultMode,
    initialSafeMoment,
    respectReducedMotion,
    epicCooldownMs,
    dedupeWindowMs,
    preset,
    icons,
  ]);

  const setMode = useCallback((next: FxMode) => {
    setModeState(next);
    engineRef.current.setMode(next);
  }, []);

  const api = useMemo<FxController>(
    () => ({
      showAchievement(event: FxEvent) {
        engineRef.current.showAchievement(event);
      },
      registerScene<TPayload extends FxEvent = FxEvent>(scene: FxSceneRegistration<TPayload>) {
        sceneRegistryRef.current.set(scene.id, scene as FxSceneRegistration<FxEvent>);
        engineRef.current.registerScene(scene);
      },
      registerScenePlayer<TPayload extends FxEvent = FxEvent>(
        sceneId: string,
        player: FxScenePlayer<TPayload>,
        schema?: FxPayloadSchema<TPayload>,
      ) {
        scenePlayerRegistryRef.current.set(sceneId, {
          player: player as FxScenePlayer<FxEvent>,
          schema: schema as FxPayloadSchema<FxEvent> | undefined,
        });
        engineRef.current.registerScenePlayer(sceneId, player, schema);
      },
      registerManifest<TPayload extends FxEvent = FxEvent>(manifest: FxSceneManifest<TPayload>) {
        manifestRegistryRef.current.set(
          manifest.id,
          manifest as unknown as FxSceneManifest<FxEvent>,
        );
        engineRef.current.registerManifest(manifest);
      },
      registerIcon(key: string, source: FxRegisteredIconSource) {
        iconRegistryRef.current.set(key, source);
        engineRef.current.registerIcon(key, source);
      },
      registerIcons(icons: Record<string, FxRegisteredIconSource>) {
        for (const [key, source] of Object.entries(icons)) {
          iconRegistryRef.current.set(key, source);
        }
        engineRef.current.registerIcons(icons);
      },
      setMode(next: FxMode) {
        setMode(next);
      },
      setSafeMoment(value: boolean) {
        engineRef.current.setSafeMoment(value);
      },
      unlockAudio() {
        engineRef.current.unlockAudio();
      },
    }),
    [setMode],
  );

  useEffect(() => {
    engineRef.current.setMode(mode);
  }, [mode]);

  return (
    <FxContext.Provider value={api}>
      {children}
      <div
        ref={hostRef}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 80,
          overflow: 'hidden',
        }}
      />
    </FxContext.Provider>
  );
}

const noopController: FxController = {
  showAchievement() {},
  registerScene() {},
  registerScenePlayer() {},
  registerManifest() {},
  registerIcon() {},
  registerIcons() {},
  setMode() {},
  setSafeMoment() {},
  unlockAudio() {},
};

export function useFx(): FxController {
  return useContext(FxContext) ?? noopController;
}
