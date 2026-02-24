import { BLEND_MODES, BlurFilter, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { RarityVisualProfile } from '../../../core/config/rarity-profile';
import { createIconSprite } from '../icon-texture';
import type { AchievementCardNodes } from './types';
import type { AchievementFxEvent, FxRarity } from '../../../types';

interface CreateAchievementCardInput {
  cameraRig: Container;
  event: AchievementFxEvent;
  profile: RarityVisualProfile;
  rarity: FxRarity;
  viewportWidth: number;
  centerX: number;
  medalY: number;
}

export function createAchievementCard(input: CreateAchievementCardInput): AchievementCardNodes {
  const ribbonWidth = Math.max(260, Math.min(360, input.viewportWidth - 112));
  const ribbonHeight = 80;
  const ribbonX = -ribbonWidth / 2;

  const medalRoot = new Container();
  medalRoot.x = input.centerX;
  medalRoot.y = input.medalY;
  medalRoot.alpha = 0;
  medalRoot.scale.set(0.62);
  input.cameraRig.addChild(medalRoot);

  const coldShadow = new Graphics();
  coldShadow.beginFill(0x000000, 1);
  coldShadow.drawRoundedRect(ribbonX - 40, -8, ribbonWidth + 80, 224, 52);
  coldShadow.endFill();
  coldShadow.beginFill(0x000000, 0.8);
  coldShadow.drawRoundedRect(ribbonX - 64, -18, ribbonWidth + 128, 246, 64);
  coldShadow.endFill();
  coldShadow.y = 22;
  coldShadow.blendMode = BLEND_MODES.MULTIPLY;
  coldShadow.alpha = 0;
  medalRoot.addChild(coldShadow);

  const ribbon = new Graphics();
  ribbon.beginFill(input.profile.ribbon, 0.95);
  ribbon.drawRoundedRect(ribbonX, -40, ribbonWidth, ribbonHeight, 22);
  ribbon.endFill();
  medalRoot.addChild(ribbon);

  const keyLight = new Graphics();
  keyLight.beginFill(0x79b6f0, 0.66);
  keyLight.drawRoundedRect(ribbonX - 10, -48, ribbonWidth + 20, 40, 18);
  keyLight.endFill();
  keyLight.beginFill(0xe6f3ff, 0.46);
  keyLight.drawRoundedRect(ribbonX + 34, -41, ribbonWidth - 68, 24, 11);
  keyLight.endFill();
  keyLight.blendMode = BLEND_MODES.ADD;
  keyLight.alpha = 0;
  medalRoot.addChild(keyLight);

  const medal = new Graphics();
  medal.beginFill(input.profile.medalFill, 1);
  medal.drawCircle(0, 0, 62);
  medal.endFill();
  medal.lineStyle(5, input.profile.medalStroke, 0.95);
  medal.drawCircle(0, 0, 58);
  medalRoot.addChild(medal);

  const iconSprite = createIconSprite(input.rarity, input.event.icon);
  medalRoot.addChild(iconSprite);

  const glowSweep = new Graphics();
  glowSweep.beginFill(0xd9ccb0, 0.13);
  glowSweep.drawRoundedRect(-34, -70, 68, 140, 14);
  glowSweep.endFill();
  glowSweep.rotation = -0.45;
  glowSweep.blendMode = BLEND_MODES.ADD;
  glowSweep.alpha = 0;
  medalRoot.addChild(glowSweep);

  const labelStyle = new TextStyle({
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.8,
    fill: input.profile.labelColor,
    align: 'center',
    stroke: '#000000',
    strokeThickness: 1,
  });
  const label = new Text(
    input.rarity === 'legendary' ? 'PROMOTION UNLOCKED' : `${input.rarity.toUpperCase()} UNLOCKED`,
    labelStyle,
  );
  label.anchor.set(0.5);
  label.y = 88;
  medalRoot.addChild(label);

  const title = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 28 : input.rarity === 'epic' ? 30 : 26,
    fontWeight: '800',
    fill: input.profile.titleColor,
    align: 'center',
    stroke: '#000000',
    strokeThickness: 2,
  });
  title.anchor.set(0.5);
  title.y = 126;

  const titleGlow = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 28 : input.rarity === 'epic' ? 30 : 26,
    fontWeight: '800',
    fill: input.profile.titleColor,
    align: 'center',
  });
  titleGlow.anchor.set(0.5);
  titleGlow.y = 126;
  titleGlow.alpha = 0;
  titleGlow.filters = [new BlurFilter(7)];
  titleGlow.blendMode = BLEND_MODES.SCREEN;
  medalRoot.addChild(titleGlow);
  medalRoot.addChild(title);

  const titleGhostR = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 28 : input.rarity === 'epic' ? 30 : 26,
    fontWeight: '800',
    fill: 0xff4f4f,
    align: 'center',
  });
  titleGhostR.anchor.set(0.5);
  titleGhostR.y = 126;
  titleGhostR.alpha = 0;
  medalRoot.addChild(titleGhostR);

  const titleGhostC = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 28 : input.rarity === 'epic' ? 30 : 26,
    fontWeight: '800',
    fill: 0x63d9ff,
    align: 'center',
  });
  titleGhostC.anchor.set(0.5);
  titleGhostC.y = 126;
  titleGhostC.alpha = 0;
  medalRoot.addChild(titleGhostC);

  const subtitle = new Text(input.event.subtitle ?? '', {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: '600',
    fill: 0xb8bfcd,
    align: 'center',
    stroke: '#000000',
    strokeThickness: 1,
  });
  subtitle.anchor.set(0.5);
  subtitle.y = 154;
  subtitle.alpha = input.event.subtitle ? 0.95 : 0;

  const subtitleGlow = new Text(input.event.subtitle ?? '', {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: '600',
    fill: 0xd3dae6,
    align: 'center',
  });
  subtitleGlow.anchor.set(0.5);
  subtitleGlow.y = 154;
  subtitleGlow.alpha = 0;
  subtitleGlow.filters = [new BlurFilter(5)];
  subtitleGlow.blendMode = BLEND_MODES.SCREEN;
  medalRoot.addChild(subtitleGlow);
  medalRoot.addChild(subtitle);

  const labelGhostR = new Text(label.text, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.8,
    fill: 0xff5d5d,
    align: 'center',
  });
  labelGhostR.anchor.set(0.5);
  labelGhostR.y = 88;
  labelGhostR.alpha = 0;
  medalRoot.addChild(labelGhostR);

  const labelGhostC = new Text(label.text, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.8,
    fill: 0x6fd7ff,
    align: 'center',
  });
  labelGhostC.anchor.set(0.5);
  labelGhostC.y = 88;
  labelGhostC.alpha = 0;
  medalRoot.addChild(labelGhostC);

  return {
    medalRoot,
    coldShadow,
    keyLight,
    glowSweep,
    ribbonWidth,
    effectWidth: ribbonWidth + 96,
    effectHeight: 260,
    label,
    titleGlow,
    title,
    subtitleGlow,
    subtitle,
    titleGhostR,
    titleGhostC,
    labelGhostR,
    labelGhostC,
  };
}
