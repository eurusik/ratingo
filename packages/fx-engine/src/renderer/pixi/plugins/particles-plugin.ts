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

type Range = readonly [number, number];

type ParticleStyle = {
  sparkRadius: Range;
  sparkSpeed: Range;
  sparkLift: Range;
  sparkSpread: number;
  sparkDirectional: boolean;
  sparkStreakChance: number;
  sparkLifeSpeed: number;
  sparkScaleGain: number;
  gravity: number;
  debrisSize: Range;
  debrisSpeed: Range;
  debrisAngle: Range;
  debrisLife: Range;
  smokeRadius: Range;
  smokeYOffset: Range;
  smokeDriftX: Range;
  smokeRise: Range;
  smokeGrow: Range;
  smokeLife: Range;
  smokeAlpha: Range;
  secondaryBurstRatio: number;
};

const PARTICLE_STYLE_BY_RARITY: Record<FxRarity, ParticleStyle> = {
  common: {
    sparkRadius: [0.95, 2.2],
    sparkSpeed: [1.7, 3.2],
    sparkLift: [0.5, 1.15],
    sparkSpread: 0.22,
    sparkDirectional: false,
    sparkStreakChance: 0.08,
    sparkLifeSpeed: 0.026,
    sparkScaleGain: 0.26,
    gravity: 0.045,
    debrisSize: [1.8, 3.8],
    debrisSpeed: [1.7, 3.4],
    debrisAngle: [-Math.PI * 0.82, -Math.PI * 0.18],
    debrisLife: [28, 64],
    smokeRadius: [14, 32],
    smokeYOffset: [24, 120],
    smokeDriftX: [-0.25, 0.25],
    smokeRise: [0.28, 0.78],
    smokeGrow: [0.0012, 0.0054],
    smokeLife: [42, 82],
    smokeAlpha: [0.05, 0.14],
    secondaryBurstRatio: 0.32,
  },
  rare: {
    sparkRadius: [1.1, 2.8],
    sparkSpeed: [2.7, 4.8],
    sparkLift: [1.05, 1.95],
    sparkSpread: 0.15,
    sparkDirectional: true,
    sparkStreakChance: 0.38,
    sparkLifeSpeed: 0.024,
    sparkScaleGain: 0.3,
    gravity: 0.048,
    debrisSize: [2.5, 5.3],
    debrisSpeed: [2.4, 5.6],
    debrisAngle: [-Math.PI * 0.9, -Math.PI * 0.06],
    debrisLife: [34, 84],
    smokeRadius: [16, 38],
    smokeYOffset: [20, 132],
    smokeDriftX: [-0.35, 0.35],
    smokeRise: [0.42, 0.9],
    smokeGrow: [0.0018, 0.0072],
    smokeLife: [48, 90],
    smokeAlpha: [0.06, 0.17],
    secondaryBurstRatio: 0.4,
  },
  epic: {
    sparkRadius: [1.3, 3.4],
    sparkSpeed: [3.1, 5.6],
    sparkLift: [1.2, 2.2],
    sparkSpread: 0.24,
    sparkDirectional: false,
    sparkStreakChance: 0.24,
    sparkLifeSpeed: 0.022,
    sparkScaleGain: 0.34,
    gravity: 0.052,
    debrisSize: [2.8, 6.4],
    debrisSpeed: [2.9, 6.9],
    debrisAngle: [-Math.PI * 0.94, Math.PI * 0.02],
    debrisLife: [40, 96],
    smokeRadius: [18, 48],
    smokeYOffset: [16, 138],
    smokeDriftX: [-0.42, 0.42],
    smokeRise: [0.5, 1.02],
    smokeGrow: [0.0022, 0.0084],
    smokeLife: [52, 96],
    smokeAlpha: [0.07, 0.2],
    secondaryBurstRatio: 0.45,
  },
  legendary: {
    sparkRadius: [1.8, 4.9],
    sparkSpeed: [3.8, 7.1],
    sparkLift: [1.5, 2.7],
    sparkSpread: 0.28,
    sparkDirectional: false,
    sparkStreakChance: 0.3,
    sparkLifeSpeed: 0.02,
    sparkScaleGain: 0.38,
    gravity: 0.059,
    debrisSize: [3.4, 8.8],
    debrisSpeed: [3.6, 8.5],
    debrisAngle: [-Math.PI * 0.96, Math.PI * 0.08],
    debrisLife: [46, 108],
    smokeRadius: [22, 70],
    smokeYOffset: [12, 146],
    smokeDriftX: [-0.5, 0.5],
    smokeRise: [0.54, 1.18],
    smokeGrow: [0.0028, 0.0102],
    smokeLife: [58, 108],
    smokeAlpha: [0.08, 0.24],
    secondaryBurstRatio: 0.52,
  },
};

interface ParticlesPluginConfig {
  cameraRig: Container;
  smokeContainer: Container;
  centerX: number;
  medalY: number;
  rarity: FxRarity;
  profile: RarityVisualProfile;
  motionScale: number;
  alphaScale: number;
  sparkCount: number;
  debrisCount: number;
  smokeCount: number;
  secondBurstMs: number;
  shockStartMs: number;
  durationMs: number;
}

export class ParticlesPlugin implements FxPlugin {
  private readonly style: ParticleStyle;
  private readonly sparks: Spark[] = [];
  private readonly debris: Debris[] = [];
  private readonly smokeClouds: SmokeCloud[] = [];
  private didSecondBurst = false;

  constructor(private readonly config: ParticlesPluginConfig) {
    this.style = PARTICLE_STYLE_BY_RARITY[this.config.rarity];
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
      spark.life += this.style.sparkLifeSpeed * frame.deltaFrames;
      spark.shape.x += spark.vx * frame.deltaFrames;
      spark.shape.y += spark.vy * frame.deltaFrames;
      spark.vy += this.style.gravity * frame.deltaFrames;
      spark.shape.alpha = clamp(
        (1 - sparkFade) * (1 - spark.life * 0.65) * this.config.alphaScale,
        0,
        1,
      );
      spark.shape.scale.set(1 + spark.life * this.style.sparkScaleGain);
    }

    for (const chunk of this.debris) {
      chunk.life += frame.deltaFrames;
      chunk.shape.x += chunk.vx * frame.deltaFrames;
      chunk.shape.y += chunk.vy * frame.deltaFrames;
      chunk.vy += this.style.gravity * 3.45 * frame.deltaFrames;
      chunk.vx *= Math.pow(chunk.drag, frame.deltaFrames);
      chunk.shape.rotation += chunk.vr * frame.deltaFrames;
      chunk.vr *= Math.pow(chunk.spinDamp, frame.deltaFrames);

      const lifeT = clamp(chunk.life / chunk.maxLife, 0, 1);
      chunk.shape.alpha = clamp(
        (1 - lifeT) * (1 - frame.fadeOutT) * 0.95 * this.config.alphaScale,
        0,
        1,
      );
    }

    for (const smoke of this.smokeClouds) {
      smoke.life += frame.deltaFrames;
      smoke.shape.x += smoke.vx * frame.deltaFrames;
      smoke.shape.y += smoke.vy * frame.deltaFrames;
      smoke.shape.scale.set(smoke.shape.scale.x + smoke.grow * frame.deltaFrames);

      const lifeT = clamp(smoke.life / smoke.maxLife, 0, 1);
      smoke.shape.alpha = smoke.alphaBase * (1 - lifeT) * (1 - frame.fadeOutT * 0.8);
    }

    if (
      this.config.profile.doubleBurst &&
      !this.didSecondBurst &&
      frame.elapsedMs > this.config.secondBurstMs
    ) {
      this.didSecondBurst = true;
      this.createBurst(
        Math.max(6, Math.round(this.config.sparkCount * this.style.secondaryBurstRatio)),
        1.12,
      );
    }
  }

  private createSmokeField(count: number): void {
    for (let i = 0; i < count; i++) {
      const cloud = new Graphics();
      const radius = randomRange(this.style.smokeRadius[0], this.style.smokeRadius[1]);
      cloud.beginFill(
        this.config.profile.smokeColor,
        randomRange(this.style.smokeAlpha[0], this.style.smokeAlpha[1]) * this.config.alphaScale,
      );
      cloud.drawCircle(0, 0, radius);
      cloud.endFill();
      cloud.x = this.config.centerX + randomRange(-95, 95);
      cloud.y =
        this.config.medalY + randomRange(this.style.smokeYOffset[0], this.style.smokeYOffset[1]);
      cloud.scale.set(randomRange(0.65, 1.1));
      this.config.smokeContainer.addChild(cloud);

      this.smokeClouds.push({
        shape: cloud,
        vx:
          randomRange(this.style.smokeDriftX[0], this.style.smokeDriftX[1]) *
          this.config.motionScale,
        vy: -randomRange(this.style.smokeRise[0], this.style.smokeRise[1]) * this.config.motionScale,
        grow:
          randomRange(this.style.smokeGrow[0], this.style.smokeGrow[1]) * this.config.motionScale,
        life: randomRange(0, 14),
        maxLife: randomRange(this.style.smokeLife[0], this.style.smokeLife[1]),
        alphaBase: cloud.alpha,
      });
    }
  }

  private createBurst(count: number, spread = 1): void {
    for (let i = 0; i < count; i++) {
      const spark = new Graphics();
      const radius =
        randomRange(this.style.sparkRadius[0], this.style.sparkRadius[1]) *
        (this.config.rarity === 'common' ? 0.9 : 1);
      const color = this.pickSparkColor();
      const streak = Math.random() < this.style.sparkStreakChance;
      this.drawSparkShape(spark, radius, color, streak);
      spark.x = this.config.centerX + (Math.random() - 0.5) * 8;
      spark.y = this.config.medalY + (Math.random() - 0.5) * 8;
      this.config.cameraRig.addChild(spark);

      const angle = this.createSparkAngle(i, count);
      const speed =
        randomRange(this.style.sparkSpeed[0], this.style.sparkSpeed[1]) *
        spread *
        this.config.motionScale;
      const lift =
        randomRange(this.style.sparkLift[0], this.style.sparkLift[1]) * this.config.motionScale;
      this.sparks.push({
        shape: spark,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - lift,
        life: 0,
      });
    }

    const debrisMultiplier =
      this.config.rarity === 'common'
        ? 0.4
        : this.config.rarity === 'rare'
          ? 0.62
          : this.config.rarity === 'epic'
            ? 0.82
            : 1;
    const debrisSpawn = Math.max(
      1,
      Math.round(this.config.debrisCount * spread * debrisMultiplier),
    );
    for (let i = 0; i < debrisSpawn; i++) {
      const chunk = new Graphics();
      const size = randomRange(this.style.debrisSize[0], this.style.debrisSize[1]);
      this.drawDebrisShape(chunk, size);
      chunk.x = this.config.centerX + randomRange(-10, 10);
      chunk.y = this.config.medalY + randomRange(-6, 7);
      chunk.rotation = randomRange(0, Math.PI * 2);
      this.config.cameraRig.addChild(chunk);

      const angle = randomRange(this.style.debrisAngle[0], this.style.debrisAngle[1]);
      const speed =
        randomRange(this.style.debrisSpeed[0], this.style.debrisSpeed[1]) *
        spread *
        this.config.motionScale;
      this.debris.push({
        shape: chunk,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomRange(1.2, 2.7) * this.config.motionScale,
        vr: randomRange(-0.35, 0.35),
        life: 0,
        maxLife: randomRange(this.style.debrisLife[0], this.style.debrisLife[1]),
        drag: randomRange(0.94, 0.975),
        spinDamp: randomRange(0.95, 0.985),
      });
    }
  }

  private createSparkAngle(index: number, count: number): number {
    if (this.style.sparkDirectional) {
      const arcStart = -Math.PI * 0.88;
      const arcEnd = -Math.PI * 0.12;
      const arcT = (index + Math.random() * 0.7) / Math.max(1, count);
      return arcStart + (arcEnd - arcStart) * arcT + randomRange(-this.style.sparkSpread, this.style.sparkSpread);
    }

    return (Math.PI * 2 * index) / Math.max(1, count) + randomRange(-this.style.sparkSpread, this.style.sparkSpread);
  }

  private pickSparkColor(): number {
    const roll = Math.random();
    if (this.config.rarity === 'common') {
      return roll > 0.18 ? this.config.profile.sparkPrimary : this.config.profile.sparkSecondary;
    }
    if (this.config.rarity === 'rare') {
      return roll > 0.35 ? this.config.profile.sparkPrimary : this.config.profile.sparkSecondary;
    }
    if (this.config.rarity === 'epic') {
      return roll > 0.58 ? this.config.profile.sparkSecondary : this.config.profile.sparkPrimary;
    }
    return roll > 0.3 ? this.config.profile.sparkSecondary : this.config.profile.sparkPrimary;
  }

  private drawSparkShape(shape: Graphics, radius: number, color: number, streak: boolean): void {
    const alpha = clamp(0.9 * this.config.alphaScale, 0, 0.98);
    shape.beginFill(color, alpha);
    if (streak) {
      const length = radius * randomRange(2.6, this.config.rarity === 'legendary' ? 5.6 : 4.6);
      const thickness = Math.max(1, radius * 0.68);
      shape.drawRoundedRect(-length * 0.5, -thickness * 0.5, length, thickness, thickness * 0.42);
      shape.rotation = randomRange(-0.85, 0.85);
    } else if (this.config.rarity !== 'common' && Math.random() > 0.62) {
      shape.drawPolygon([0, -radius, radius * 0.75, 0, 0, radius, -radius * 0.75, 0]);
    } else {
      shape.drawCircle(0, 0, radius);
    }
    shape.endFill();
  }

  private drawDebrisShape(shape: Graphics, size: number): void {
    shape.beginFill(
      this.config.profile.debrisColor,
      clamp(randomRange(0.62, 0.95) * this.config.alphaScale, 0, 1),
    );
    if (this.config.rarity === 'common') {
      shape.drawRoundedRect(-size * 0.45, -size * 0.32, size, size * randomRange(0.34, 0.62), 1);
      shape.endFill();
      return;
    }

    if (Math.random() > 0.5) {
      shape.drawRoundedRect(-size * 0.46, -size * 0.3, size, size * randomRange(0.36, 0.82), 1.2);
    } else {
      shape.drawPolygon([
        -size * 0.48,
        -size * 0.3,
        size * 0.44,
        -size * 0.24,
        size * 0.16,
        size * 0.42,
        -size * 0.38,
        size * 0.36,
      ]);
    }
    shape.endFill();
  }
}
