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
}: FxProviderProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FxEngine>(new FxEngine(noopRenderer, noopAudio));
  const [mode, setModeState] = useState<FxMode>(defaultMode);

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
    });

    engineRef.current = engine;

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
    defaultMode,
    initialSafeMoment,
    respectReducedMotion,
    epicCooldownMs,
    dedupeWindowMs,
    preset,
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
        engineRef.current.registerScene(scene);
      },
      registerScenePlayer<TPayload extends FxEvent = FxEvent>(
        sceneId: string,
        player: FxScenePlayer<TPayload>,
        schema?: FxPayloadSchema<TPayload>,
      ) {
        engineRef.current.registerScenePlayer(sceneId, player, schema);
      },
      registerManifest<TPayload extends FxEvent = FxEvent>(manifest: FxSceneManifest<TPayload>) {
        engineRef.current.registerManifest(manifest);
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
  setMode() {},
  setSafeMoment() {},
  unlockAudio() {},
};

export function useFx(): FxController {
  return useContext(FxContext) ?? noopController;
}
