import { BLEND_MODES, Container, Graphics } from 'pixi.js';
import type { RarityVisualProfile } from '../../../core/config/rarity-profile';
import { randomRange } from '../../../core/math/scalars';
import type { FxRarity } from '../../../types';
import type { BackdropLayers } from './types';

interface CreateBackdropLayersInput {
  root: Container;
  cameraRig: Container;
  profile: RarityVisualProfile;
  rarity: FxRarity;
  shockwaveEnabled: boolean;
  width: number;
  height: number;
  centerX: number;
  medalY: number;
}

export function createBackdropLayers(input: CreateBackdropLayersInput): BackdropLayers {
  const focusVeil = new Graphics();
  focusVeil.beginFill(0x02060e, 1);
  focusVeil.drawRect(0, 0, input.width, input.height);
  focusVeil.endFill();
  focusVeil.alpha = 0;
  input.root.addChildAt(focusVeil, 0);

  const tint = new Graphics();
  tint.beginFill(input.profile.overlayTint, 0);
  tint.drawRect(0, 0, input.width, input.height);
  tint.endFill();
  tint.blendMode = BLEND_MODES.ADD;
  input.root.addChild(tint);

  const vignette = new Graphics();
  vignette.beginFill(0x000000, 0);
  vignette.drawRect(0, 0, input.width, input.height);
  vignette.endFill();
  input.root.addChild(vignette);

  const scanline = new Graphics();
  for (let y = 0; y < input.height; y += 4) {
    const alpha = (y / 4) % 2 === 0 ? 0.028 : 0.012;
    scanline.beginFill(0x000000, alpha);
    scanline.drawRect(0, y, input.width, 2);
    scanline.endFill();
  }
  scanline.alpha = 0;
  input.root.addChild(scanline);

  const noiseDots = new Graphics();
  for (let i = 0; i < 170; i++) {
    noiseDots.beginFill(Math.random() > 0.58 ? 0xc7b994 : 0x6a6a6a, randomRange(0.01, 0.06));
    noiseDots.drawRect(
      randomRange(0, input.width),
      randomRange(0, input.height),
      randomRange(0.8, 2),
      randomRange(0.8, 2),
    );
    noiseDots.endFill();
  }
  noiseDots.alpha = 0;
  input.root.addChild(noiseDots);

  const flash = new Graphics();
  flash.beginFill(0xf5f4ea, 0);
  flash.drawRect(0, 0, input.width, input.height);
  flash.endFill();
  input.root.addChild(flash);

  const glitchBands = new Graphics();
  glitchBands.alpha = 0;
  input.root.addChild(glitchBands);

  const interferenceStrips = new Graphics();
  interferenceStrips.alpha = 0;
  interferenceStrips.blendMode = BLEND_MODES.NORMAL;
  input.root.addChild(interferenceStrips);

  const signalStatic = new Graphics();
  signalStatic.alpha = 0;
  signalStatic.blendMode = BLEND_MODES.NORMAL;
  input.root.addChild(signalStatic);

  const cutPulse = new Graphics();
  cutPulse.beginFill(0x000000, 1);
  cutPulse.drawRect(0, 0, input.width, input.height);
  cutPulse.endFill();
  cutPulse.alpha = 0;
  input.root.addChild(cutPulse);

  const smokeContainer = new Container();
  input.cameraRig.addChild(smokeContainer);

  let shockwave: Graphics | undefined;
  if (input.shockwaveEnabled) {
    const node = new Graphics();
    node.lineStyle(5, input.profile.sparkSecondary, 0.8);
    node.drawCircle(0, 0, 84);
    node.x = input.centerX;
    node.y = input.medalY;
    node.alpha = 0;
    input.cameraRig.addChild(node);
    shockwave = node;
  }

  let shockwave2: Graphics | undefined;
  if (input.shockwaveEnabled && input.profile.doubleBurst) {
    const node = new Graphics();
    node.lineStyle(3, input.profile.sparkPrimary, 0.85);
    node.drawCircle(0, 0, 68);
    node.x = input.centerX;
    node.y = input.medalY;
    node.alpha = 0;
    input.cameraRig.addChild(node);
    shockwave2 = node;
  }

  let aura: Graphics | undefined;
  if (input.rarity === 'epic' || input.rarity === 'legendary') {
    const node = new Graphics();
    node.beginFill(input.profile.sparkSecondary, input.rarity === 'legendary' ? 0.18 : 0.12);
    node.drawCircle(0, 0, input.rarity === 'legendary' ? 110 : 90);
    node.endFill();
    node.blendMode = BLEND_MODES.ADD;
    node.x = input.centerX;
    node.y = input.medalY;
    node.alpha = 0;
    input.cameraRig.addChild(node);
    aura = node;
  }

  return {
    focusVeil,
    tint,
    vignette,
    scanline,
    noiseDots,
    flash,
    glitchBands,
    interferenceStrips,
    signalStatic,
    cutPulse,
    smokeContainer,
    shockwave,
    shockwave2,
    aura,
  };
}
