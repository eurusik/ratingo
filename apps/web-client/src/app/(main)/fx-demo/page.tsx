'use client';

import { useEffect, useState } from 'react';
import { FxProvider, useFx, type FxMode, type FxRarity } from '@ratingo/fx-engine';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';

const DEMO_RARITIES: FxRarity[] = ['common', 'rare', 'epic', 'legendary'];
const DEMO_MODES: FxMode[] = ['off', 'lite', 'epic'];

function DemoControls() {
  const fx = useFx();
  const [mode, setMode] = useState<FxMode>('epic');
  const [safeMoment, setSafeMoment] = useState(true);

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
        });
      }, index * 80);
    });
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
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
