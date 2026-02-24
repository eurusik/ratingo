'use client';

import { useEffect, useState } from 'react';
import { FxProvider, useFx, type FxMode, type FxRarity } from '@ratingo/fx-engine';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Slider } from '@/shared/ui';

const DEMO_RARITIES: FxRarity[] = ['common', 'rare', 'epic', 'legendary'];
const DEMO_MODES: FxMode[] = ['off', 'lite', 'epic'];

function DemoControls() {
  const fx = useFx();
  const [mode, setMode] = useState<FxMode>('epic');
  const [safeMoment, setSafeMoment] = useState(true);
  const [veilAlpha, setVeilAlpha] = useState(0.42);
  const [shadowAlpha, setShadowAlpha] = useState(0.46);
  const [keyLightBase, setKeyLightBase] = useState(0.18);
  const [keyLightImpact, setKeyLightImpact] = useState(0.34);
  const [keyLightWindowMs, setKeyLightWindowMs] = useState(60);

  useEffect(() => {
    fx.setMode(mode);
  }, [fx, mode]);

  useEffect(() => {
    fx.setSafeMoment(safeMoment);
  }, [fx, safeMoment]);

  const triggerDemo = (rarity: FxRarity) => {
    fx.showAchievement({
      id: `demo-${rarity}-${Date.now()}`,
      title: rarity === 'legendary' ? 'Legendary Unlocked' : `${rarity.toUpperCase()} unlocked`,
      subtitle: 'Battlefield-style cinematic popup',
      rarity,
      icon: rarity,
      metadata: {
        lighting: {
          veilAlpha,
          shadowAlpha,
          keyLightBase,
          keyLightImpact,
          keyLightWindowMs,
        },
      },
    });
  };

  const triggerBurst = () => {
    DEMO_RARITIES.forEach((rarity, index) => {
      window.setTimeout(() => {
        fx.showAchievement({
          id: `burst-${rarity}-${index}-${Date.now()}`,
          title: `${rarity.toUpperCase()} chain`,
          subtitle: `Queue item #${index + 1}`,
          rarity,
          icon: rarity === 'common' ? '●' : '★',
          metadata: {
            lighting: {
              veilAlpha,
              shadowAlpha,
              keyLightBase,
              keyLightImpact,
              keyLightWindowMs,
            },
          },
        });
      }, index * 80);
    });
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-6 md:px-4">
      <Card className="border-cinema-borderSoft bg-cinema-card/60">
        <CardHeader>
          <CardTitle className="text-cinema-text-primary">FX Engine Demo (Pixi)</CardTitle>
          <CardDescription className="text-cinema-text-muted">
            Isolated demo page for Battlefield-style achievement animation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {DEMO_MODES.map((item) => (
              <Button
                key={item}
                variant={mode === item ? 'default' : 'outline'}
                onClick={() => setMode(item)}
                className="min-w-20"
              >
                {item}
              </Button>
            ))}
            <Button variant={safeMoment ? 'default' : 'outline'} onClick={() => setSafeMoment((v) => !v)}>
              safeMoment: {safeMoment ? 'on' : 'off'}
            </Button>
            <Button variant="secondary" onClick={() => fx.unlockAudio()}>
              unlock audio
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {DEMO_RARITIES.map((rarity) => (
              <Button key={rarity} onClick={() => triggerDemo(rarity)}>
                trigger {rarity}
              </Button>
            ))}
            <Button variant="destructive" onClick={triggerBurst}>
              burst queue
            </Button>
          </div>

          <div className="space-y-4 rounded-lg border border-cinema-borderSoft/80 bg-cinema-bg/50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm text-cinema-text-muted">veilAlpha: {veilAlpha.toFixed(2)}</div>
                <Slider value={[veilAlpha]} min={0} max={0.7} step={0.01} onValueChange={(v) => setVeilAlpha(v[0] ?? 0.42)} />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-cinema-text-muted">shadowAlpha: {shadowAlpha.toFixed(2)}</div>
                <Slider value={[shadowAlpha]} min={0} max={0.65} step={0.01} onValueChange={(v) => setShadowAlpha(v[0] ?? 0.46)} />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-cinema-text-muted">keyLightBase: {keyLightBase.toFixed(2)}</div>
                <Slider value={[keyLightBase]} min={0} max={0.5} step={0.01} onValueChange={(v) => setKeyLightBase(v[0] ?? 0.18)} />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-cinema-text-muted">keyLightImpact: {keyLightImpact.toFixed(2)}</div>
                <Slider value={[keyLightImpact]} min={0} max={0.6} step={0.01} onValueChange={(v) => setKeyLightImpact(v[0] ?? 0.34)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm text-cinema-text-muted">keyLightWindowMs: {Math.round(keyLightWindowMs)} ms</div>
                <Slider
                  value={[keyLightWindowMs]}
                  min={24}
                  max={240}
                  step={1}
                  onValueChange={(v) => setKeyLightWindowMs(v[0] ?? 60)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function FxDemoPage() {
  return (
    <FxProvider
      defaultMode="epic"
      initialSafeMoment
      respectReducedMotion={false}
      epicCooldownMs={0}
    >
      <DemoControls />
    </FxProvider>
  );
}
