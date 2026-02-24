import { Container, Graphics } from 'pixi.js';
import type { RarityVisualProfile } from '../../../core/config/rarity-profile';
import { clamp, randomRange } from '../../../core/math/scalars';
import type { FxRarity } from '../../../types';
import type { FxFrameState, FxPlugin } from './types';

type Spark = {
  shape: Graphics;
  vx: number;
  vy: number;
  life: number;
};

type Debris = {
  shape: Graphics;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  maxLife: number;
  drag: number;
  spinDamp: number;
};

type SmokeCloud = {
  shape: Graphics;
  vx: number;
  vy: number;
  grow: number;
  life: number;
  maxLife: number;
  alphaBase: number;
};

interface ParticlesPluginConfig {
  cameraRig: Container;
  smokeContainer: Container;
  centerX: number;
  medalY: number;
  rarity: FxRarity;
  profile: RarityVisualProfile;
  liteFactor: number;
  sparkCount: number;
  debrisCount: number;
  smokeCount: number;
  secondBurstMs: number;
  shockStartMs: number;
  durationMs: number;
}

export class ParticlesPlugin implements FxPlugin {
  private readonly sparks: Spark[] = [];
  private readonly debris: Debris[] = [];
  private readonly smokeClouds: SmokeCloud[] = [];
  private didSecondBurst = false;

  constructor(private readonly config: ParticlesPluginConfig) {
    this.createSmokeField(this.config.smokeCount);
    this.createBurst(this.config.sparkCount);
  }

  update(frame: FxFrameState): void {
    const sparkFade = clamp(
      (frame.elapsedMs - this.config.shockStartMs) / (this.config.durationMs * 0.36),
      0,
      1,
    );

    for (const spark of this.sparks) {
      spark.life += 0.02 * frame.deltaFrames;
      spark.shape.x += spark.vx * frame.deltaFrames;
      spark.shape.y += spark.vy * frame.deltaFrames;
      spark.vy += 0.048 * frame.deltaFrames;
      spark.shape.alpha = (1 - sparkFade) * (1 - spark.life * 0.65);
      spark.shape.scale.set(1 + spark.life * 0.35);
    }

    for (const chunk of this.debris) {
      chunk.life += frame.deltaFrames;
      chunk.shape.x += chunk.vx * frame.deltaFrames;
      chunk.shape.y += chunk.vy * frame.deltaFrames;
      chunk.vy += 0.18 * frame.deltaFrames;
      chunk.vx *= Math.pow(chunk.drag, frame.deltaFrames);
      chunk.shape.rotation += chunk.vr * frame.deltaFrames;
      chunk.vr *= Math.pow(chunk.spinDamp, frame.deltaFrames);

      const lifeT = clamp(chunk.life / chunk.maxLife, 0, 1);
      chunk.shape.alpha = (1 - lifeT) * (1 - frame.fadeOutT) * 0.95;
    }

    for (const smoke of this.smokeClouds) {
      smoke.life += frame.deltaFrames;
      smoke.shape.x += smoke.vx * frame.deltaFrames;
      smoke.shape.y += smoke.vy * frame.deltaFrames;
      smoke.shape.scale.set(smoke.shape.scale.x + smoke.grow * frame.deltaFrames);

      const lifeT = clamp(smoke.life / smoke.maxLife, 0, 1);
      smoke.shape.alpha = smoke.alphaBase * (1 - lifeT) * (1 - frame.fadeOutT * 0.8);
    }

    if (this.config.profile.doubleBurst && !this.didSecondBurst && frame.elapsedMs > this.config.secondBurstMs) {
      this.didSecondBurst = true;
      this.createBurst(Math.max(6, Math.round(this.config.sparkCount * 0.45)), 1.2);
    }
  }

  private createSmokeField(count: number): void {
    for (let i = 0; i < count; i++) {
      const cloud = new Graphics();
      const radius = randomRange(
        this.config.rarity === 'legendary' ? 28 : 18,
        this.config.rarity === 'legendary' ? 70 : 46,
      );
      cloud.beginFill(this.config.profile.smokeColor, randomRange(0.08, 0.22) * (this.config.liteFactor < 1 ? 0.6 : 1));
      cloud.drawCircle(0, 0, radius);
      cloud.endFill();
      cloud.x = this.config.centerX + randomRange(-95, 95);
      cloud.y = this.config.medalY + randomRange(20, 140);
      cloud.scale.set(randomRange(0.65, 1.1));
      this.config.smokeContainer.addChild(cloud);

      this.smokeClouds.push({
        shape: cloud,
        vx: randomRange(-0.35, 0.35) * this.config.liteFactor,
        vy: randomRange(-0.95, -0.22) * this.config.liteFactor,
        grow: randomRange(0.002, 0.01) * this.config.liteFactor,
        life: randomRange(0, 14),
        maxLife: randomRange(48, 96),
        alphaBase: cloud.alpha,
      });
    }
  }

  private createBurst(count: number, spread = 1): void {
    for (let i = 0; i < count; i++) {
      const spark = new Graphics();
      const radius = Math.random() * (this.config.rarity === 'legendary' ? 4.5 : 3.1) + 1.1;
      spark.beginFill(
        Math.random() > 0.35 ? this.config.profile.sparkPrimary : this.config.profile.sparkSecondary,
        0.95,
      );
      spark.drawCircle(0, 0, radius);
      spark.endFill();
      spark.x = this.config.centerX + (Math.random() - 0.5) * 8;
      spark.y = this.config.medalY + (Math.random() - 0.5) * 8;
      this.config.cameraRig.addChild(spark);

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const baseSpeed =
        this.config.rarity === 'legendary' ? 5.4 : this.config.rarity === 'epic' ? 4.8 : 3.6;
      const speed = (Math.random() * baseSpeed + 1.9) * this.config.liteFactor * spread;
      this.sparks.push({
        shape: spark,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomRange(1.3, 2.2),
        life: 0,
      });
    }

    const debrisSpawn = Math.max(1, Math.round(this.config.debrisCount * spread * 0.7));
    for (let i = 0; i < debrisSpawn; i++) {
      const chunk = new Graphics();
      const size = randomRange(2.5, this.config.rarity === 'legendary' ? 8.8 : 6.6);
      chunk.beginFill(this.config.profile.debrisColor, randomRange(0.65, 0.95));
      if (Math.random() > 0.5) {
        chunk.drawRoundedRect(-size * 0.45, -size * 0.3, size, size * randomRange(0.35, 0.78), 1.2);
      } else {
        chunk.drawPolygon([
          -size * 0.45,
          -size * 0.25,
          size * 0.42,
          -size * 0.28,
          size * 0.15,
          size * 0.4,
          -size * 0.36,
          size * 0.35,
        ]);
      }
      chunk.endFill();
      chunk.x = this.config.centerX + randomRange(-10, 10);
      chunk.y = this.config.medalY + randomRange(-6, 7);
      chunk.rotation = randomRange(0, Math.PI * 2);
      this.config.cameraRig.addChild(chunk);

      const angle = randomRange(-Math.PI * 0.9, Math.PI * 0.1);
      const speed =
        randomRange(2.8, this.config.rarity === 'legendary' ? 8.6 : 6.1) * spread * this.config.liteFactor;
      this.debris.push({
        shape: chunk,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomRange(1.8, 3.4),
        vr: randomRange(-0.35, 0.35),
        life: 0,
        maxLife: randomRange(38, 96),
        drag: randomRange(0.94, 0.975),
        spinDamp: randomRange(0.95, 0.985),
      });
    }
  }
}
