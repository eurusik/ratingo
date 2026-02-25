'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FxProvider,
  useFx,
  type FxAudioHints,
  type FxIconInput,
  type FxMode,
  type FxRarity,
  type FxRegisteredIconSource,
} from '@ratingo/fx-engine';
import { demoScanImpactSceneId, playScanImpactScene } from './scenes/play-scan-impact-scene';
import { demoTerminalFeedSceneId, playTerminalFeedScene } from './scenes/play-terminal-feed-scene';

const DEMO_MODES: FxMode[] = ['off', 'lite', 'epic'];

type DemoSceneKind = 'default' | 'scan' | 'terminal';
type AudioPresetKey = 'neutral' | 'sharp' | 'heavy' | 'test' | 'prestige';

interface DemoCase {
  id: string;
  name: string;
  description: string;
  scene: DemoSceneKind;
  rarity: FxRarity;
  audioPreset: AudioPresetKey;
  iconSource: string;
  icon?: FxIconInput;
  title: string;
  subtitle: string;
}

const LIBRARY_ICONS: Record<string, FxRegisteredIconSource> = {
  'ghost-mask': {
    type: 'svg',
    cacheKey: 'ghost-mask',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1b2029" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-4.7 0-8 3.3-8 8v10l3-2 3 2 2-2 2 2 3-2 3 2V11c0-4.7-3.3-8-8-8Z"/><path d="M9 11h.01"/><path d="M15 11h.01"/><path d="M9 15c1 .8 2 .8 3 .8s2 0 3-.8"/></svg>`,
  },
  'radar-pulse': {
    type: 'url',
    url: '/icons/fx-radar-pulse.svg',
    cacheKey: 'fx-radar-pulse',
  },
  'rank-ribbon': {
    type: 'builtin',
    key: 'ribbon',
  },
};

const INLINE_CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1b2029" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m4 14 8-8 8 8"/><path d="m4 20 8-8 8 8"/></svg>`;

const AUDIO_PRESETS: Record<AudioPresetKey, { label: string; hints?: FxAudioHints }> = {
  neutral: { label: 'Default levelup (base mix)' },
  sharp: {
    label: 'Sharp: faster + quieter',
    hints: { playbackRateMultiplier: 1.12, volumeMultiplier: 0.84 },
  },
  heavy: {
    label: 'Heavy: slower + louder',
    hints: { playbackRateMultiplier: 0.84, volumeMultiplier: 1.26 },
  },
  test: {
    label: 'test_levelup.wav (3558ms)',
    hints: {
      volumeMultiplier: 0.94,
      playbackRateMultiplier: 1.053,
      source: {
        wav: '/sounds/test_levelup.wav',
        durationMs: 3558,
        cacheKey: 'test_levelup',
      },
    },
  },
  prestige: {
    label: 'test_prestigelevelup.wav (3557ms)',
    hints: {
      volumeMultiplier: 0.88,
      playbackRateMultiplier: 1.075,
      source: {
        wav: '/sounds/test_prestigelevelup.wav',
        durationMs: 3557,
        cacheKey: 'test_prestigelevelup',
      },
    },
  },
};

const SCENE_LABELS: Record<DemoSceneKind, string> = {
  default: 'Classic Medal',
  scan: 'Scan Impact',
  terminal: 'Terminal Feed',
};

const SCENE_CASES: DemoCase[] = [
  {
    id: 'scene-classic',
    name: 'Classic Medal (baseline)',
    description: 'Standard achievement scene from Ratingo preset.',
    scene: 'default',
    rarity: 'epic',
    audioPreset: 'neutral',
    iconSource: 'builtin',
    icon: { type: 'builtin', key: 'ribbon' },
    title: 'Baseline Scene',
    subtitle: 'Default style to compare against custom scenes',
  },
  {
    id: 'scene-scan',
    name: 'Scan Impact Scene',
    description: 'Alternative scan-line scene with motion-heavy transitions.',
    scene: 'scan',
    rarity: 'epic',
    audioPreset: 'test',
    iconSource: 'library',
    icon: { type: 'library', key: 'ghost-mask' },
    title: 'TACTICAL SCAN',
    subtitle: 'Custom scene with test_levelup.wav timing',
  },
  {
    id: 'scene-terminal',
    name: 'Terminal Feed Scene',
    description: 'Different design language: HUD panel + mono text + data bars.',
    scene: 'terminal',
    rarity: 'legendary',
    audioPreset: 'prestige',
    iconSource: 'none',
    title: 'PRESTIGE AUTHORIZED',
    subtitle: 'Custom terminal scene with prestige timing',
  },
];

const ICON_CASES: DemoCase[] = [
  {
    id: 'icon-builtin',
    name: 'Builtin icon',
    description: 'Icon source: built-in trophy key.',
    scene: 'default',
    rarity: 'legendary',
    audioPreset: 'neutral',
    iconSource: 'builtin:trophy',
    icon: { type: 'builtin', key: 'trophy' },
    title: 'Builtin Trophy',
    subtitle: 'Built-in icon source',
  },
  {
    id: 'icon-library',
    name: 'Library icon',
    description: 'Icon source: registered icon library key.',
    scene: 'default',
    rarity: 'epic',
    audioPreset: 'heavy',
    iconSource: 'library:ghost-mask',
    icon: { type: 'library', key: 'ghost-mask' },
    title: 'Library Icon',
    subtitle: 'Icon from registerIcons map',
  },
  {
    id: 'icon-svg',
    name: 'Inline SVG icon',
    description: 'Icon source: raw SVG payload.',
    scene: 'default',
    rarity: 'rare',
    audioPreset: 'sharp',
    iconSource: 'svg:inline',
    icon: { type: 'svg', svg: INLINE_CHEVRON_SVG, cacheKey: 'inline-chevron' },
    title: 'Inline SVG',
    subtitle: 'Direct SVG icon source',
  },
  {
    id: 'icon-lucide',
    name: 'Lucide icon (lazy)',
    description: 'Icon source: lazy dynamic import from Lucide set.',
    scene: 'default',
    rarity: 'epic',
    audioPreset: 'neutral',
    iconSource: 'lucide:ghost',
    icon: { type: 'lucide', name: 'ghost' },
    title: 'Lucide Ghost',
    subtitle: 'Lazy-loaded lucide icon source',
  },
  {
    id: 'icon-url',
    name: 'URL icon',
    description: 'Icon source: image loaded from /public/icons.',
    scene: 'default',
    rarity: 'common',
    audioPreset: 'heavy',
    iconSource: 'url:/icons/fx-radar-pulse.svg',
    icon: { type: 'url', url: '/icons/fx-radar-pulse.svg', cacheKey: 'url-radar' },
    title: 'URL Icon',
    subtitle: 'Texture loaded from URL',
  },
];

const AUDIO_CASES: DemoCase[] = [
  {
    id: 'audio-neutral',
    name: 'Audio: neutral',
    description: 'Default levelup sound with base profile.',
    scene: 'default',
    rarity: 'epic',
    audioPreset: 'neutral',
    iconSource: 'builtin:ribbon',
    icon: { type: 'builtin', key: 'ribbon' },
    title: 'Audio Neutral',
    subtitle: 'Base loudness and timing',
  },
  {
    id: 'audio-sharp',
    name: 'Audio: sharp',
    description: 'Higher pitch and lower volume.',
    scene: 'default',
    rarity: 'rare',
    audioPreset: 'sharp',
    iconSource: 'builtin:shield',
    icon: { type: 'builtin', key: 'shield' },
    title: 'Audio Sharp',
    subtitle: 'Faster playback profile',
  },
  {
    id: 'audio-heavy',
    name: 'Audio: heavy',
    description: 'Lower pitch and stronger volume.',
    scene: 'default',
    rarity: 'epic',
    audioPreset: 'heavy',
    iconSource: 'builtin:ribbon',
    icon: { type: 'builtin', key: 'ribbon' },
    title: 'Audio Heavy',
    subtitle: 'Heavier playback profile',
  },
  {
    id: 'audio-test',
    name: 'Audio: test_levelup.wav',
    description: 'Custom wav source with 3558ms tuned timeline.',
    scene: 'default',
    rarity: 'epic',
    audioPreset: 'test',
    iconSource: 'library:rank-ribbon',
    icon: { type: 'library', key: 'rank-ribbon' },
    title: 'Test Level Up',
    subtitle: 'Custom source test_levelup.wav',
  },
  {
    id: 'audio-prestige',
    name: 'Audio: test_prestigelevelup.wav',
    description: 'Custom wav source with 3557ms tuned timeline.',
    scene: 'default',
    rarity: 'legendary',
    audioPreset: 'prestige',
    iconSource: 'builtin:trophy',
    icon: { type: 'builtin', key: 'trophy' },
    title: 'Prestige Level Up',
    subtitle: 'Custom source test_prestigelevelup.wav',
  },
];

interface LastRunState {
  caseName: string;
  scene: DemoSceneKind;
  audioPreset: AudioPresetKey;
  rarity: FxRarity;
  startedAt: string;
}

function DemoControls() {
  const fx = useFx();
  const [mode, setMode] = useState<FxMode>('epic');
  const [safeMoment, setSafeMoment] = useState(true);
  const [lastRun, setLastRun] = useState<LastRunState | null>(null);

  useEffect(() => {
    fx.setMode(mode);
  }, [fx, mode]);

  useEffect(() => {
    fx.setSafeMoment(safeMoment);
  }, [fx, safeMoment]);

  useEffect(() => {
    fx.registerIcons(LIBRARY_ICONS);
  }, [fx]);

  useEffect(() => {
    fx.registerScene({
      id: demoScanImpactSceneId,
      priority: 180,
      supports(event) {
        return event.metadata?.demoScene === demoScanImpactSceneId;
      },
      create(event, rarity) {
        return {
          sceneId: demoScanImpactSceneId,
          rarity,
          payload: {
            ...event,
            rarity,
          },
        };
      },
    });
    fx.registerScenePlayer(demoScanImpactSceneId, playScanImpactScene);
  }, [fx]);

  useEffect(() => {
    fx.registerScene({
      id: demoTerminalFeedSceneId,
      priority: 200,
      supports(event) {
        return event.metadata?.demoScene === demoTerminalFeedSceneId;
      },
      create(event, rarity) {
        return {
          sceneId: demoTerminalFeedSceneId,
          rarity,
          payload: {
            ...event,
            rarity,
          },
        };
      },
    });
    fx.registerScenePlayer(demoTerminalFeedSceneId, playTerminalFeedScene);
  }, [fx]);

  const runDemoCase = (demoCase: DemoCase) => {
    const metadata =
      demoCase.scene === 'default'
        ? undefined
        : {
            demoScene:
              demoCase.scene === 'scan'
                ? demoScanImpactSceneId
                : demoCase.scene === 'terminal'
                  ? demoTerminalFeedSceneId
                  : undefined,
          };

    fx.showAchievement({
      id: `case-${demoCase.id}-${Date.now()}`,
      title: demoCase.title,
      subtitle: demoCase.subtitle,
      rarity: demoCase.rarity,
      icon: demoCase.icon,
      audio: AUDIO_PRESETS[demoCase.audioPreset].hints,
      metadata,
    });

    setLastRun({
      caseName: demoCase.name,
      scene: demoCase.scene,
      audioPreset: demoCase.audioPreset,
      rarity: demoCase.rarity,
      startedAt: new Date().toLocaleTimeString(),
    });
  };

  const runBatch = (cases: DemoCase[]) => {
    cases.forEach((demoCase, index) => {
      window.setTimeout(() => runDemoCase(demoCase), index * 420);
    });
  };

  const sections = useMemo(
    () => [
      {
        id: 'scene',
        title: 'Scene Showcase',
        description: 'Same engine, but different scene players and layout language.',
        cases: SCENE_CASES,
      },
      {
        id: 'icon',
        title: 'Icon Showcase',
        description: 'Same scene, different icon source strategies.',
        cases: ICON_CASES,
      },
      {
        id: 'audio',
        title: 'Audio Showcase',
        description: 'Same visuals, different audio source/profile combinations.',
        cases: AUDIO_CASES,
      },
    ],
    [],
  );

  return (
    <main className="page">
      <section className="card">
        <h1 className="title">FX Engine Standalone Demo</h1>
        <p className="subtitle">
          Structured showcase: what changes by Scene, Icon source, and Audio profile.
        </p>

        <div className="controlPanel">
          <div className="controlGroup">
            <span className="controlLabel">Mode</span>
            <div className="pillRow">
              {DEMO_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`btn ${mode === value ? 'active' : ''}`}
                  onClick={() => setMode(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="controlGroup">
            <span className="controlLabel">Session</span>
            <div className="pillRow">
              <button
                type="button"
                className={`btn ${safeMoment ? 'active' : ''}`}
                onClick={() => setSafeMoment((prev) => !prev)}
              >
                safeMoment: {safeMoment ? 'on' : 'off'}
              </button>
              <button type="button" className="btn" onClick={() => fx.unlockAudio()}>
                unlock audio
              </button>
            </div>
          </div>

          <div className="runStatus">
            {lastRun ? (
              <>
                <strong>Last run:</strong> {lastRun.caseName} | {SCENE_LABELS[lastRun.scene]} |{' '}
                {AUDIO_PRESETS[lastRun.audioPreset].label} | {lastRun.rarity} | {lastRun.startedAt}
              </>
            ) : (
              <>Last run: none</>
            )}
          </div>
        </div>

        {sections.map((section) => (
          <section key={section.id} className="showcaseSection">
            <div className="sectionHeader">
              <div>
                <h2 className="sectionTitle">{section.title}</h2>
                <p className="sectionDescription">{section.description}</p>
              </div>
              <button type="button" className="btn" onClick={() => runBatch(section.cases)}>
                run all {section.id}
              </button>
            </div>

            <div className="caseGrid">
              {section.cases.map((demoCase) => (
                <article key={demoCase.id} className="caseCard">
                  <h3 className="caseTitle">{demoCase.name}</h3>
                  <p className="caseDescription">{demoCase.description}</p>
                  <div className="metaRow">
                    <span className="metaTag">Scene: {SCENE_LABELS[demoCase.scene]}</span>
                    <span className="metaTag">Audio: {demoCase.audioPreset}</span>
                    <span className="metaTag">Rarity: {demoCase.rarity}</span>
                    <span className="metaTag">Icon: {demoCase.iconSource}</span>
                  </div>
                  <button type="button" className="btn runBtn" onClick={() => runDemoCase(demoCase)}>
                    run case
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <FxProvider
      defaultMode="epic"
      initialSafeMoment
      respectReducedMotion={false}
      epicCooldownMs={0}
      icons={LIBRARY_ICONS}
    >
      <DemoControls />
    </FxProvider>
  );
}
