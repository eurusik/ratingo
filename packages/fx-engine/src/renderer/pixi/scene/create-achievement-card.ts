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
  const labelBaseY = 88;
  const titleBaseY = 126;

  const medalRoot = new Container();
  medalRoot.x = input.centerX;
  medalRoot.y = input.medalY;
  medalRoot.alpha = 0;
  medalRoot.scale.set(0.62);
  input.cameraRig.addChild(medalRoot);

  const coldShadow = new Graphics();
  coldShadow.beginFill(0x000000, 1);
  coldShadow.drawRoundedRect(ribbonX - 16, 6, ribbonWidth + 32, 178, 38);
  coldShadow.endFill();
  coldShadow.beginFill(0x000000, 0.8);
  coldShadow.drawRoundedRect(ribbonX - 26, -2, ribbonWidth + 52, 196, 46);
  coldShadow.endFill();
  coldShadow.y = 30;
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
  label.y = labelBaseY;
  medalRoot.addChild(label);

  const title = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 28 : input.rarity === 'epic' ? 30 : 26,
    fontWeight: '800',
    fill: input.profile.titleColor,
    align: 'center',
    stroke: '#000000',
    strokeThickness: 2,
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 110),
  });
  title.anchor.set(0.5);
  title.y = titleBaseY;

  const titleGlow = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 28 : input.rarity === 'epic' ? 30 : 26,
    fontWeight: '800',
    fill: input.profile.titleColor,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 110),
  });
  titleGlow.anchor.set(0.5);
  titleGlow.y = titleBaseY;
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
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 110),
  });
  titleGhostR.anchor.set(0.5);
  titleGhostR.y = titleBaseY;
  titleGhostR.alpha = 0;
  medalRoot.addChild(titleGhostR);

  const titleGhostC = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 28 : input.rarity === 'epic' ? 30 : 26,
    fontWeight: '800',
    fill: 0x63d9ff,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 110),
  });
  titleGhostC.anchor.set(0.5);
  titleGhostC.y = titleBaseY;
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
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 90),
  });
  subtitle.anchor.set(0.5);
  const subtitleBaseY = titleBaseY + title.height / 2 + 16 + subtitle.height / 2;
  subtitle.y = subtitleBaseY;
  subtitle.alpha = input.event.subtitle ? 0.95 : 0;

  const subtitleGlow = new Text(input.event.subtitle ?? '', {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: '600',
    fill: 0xd3dae6,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 90),
  });
  subtitleGlow.anchor.set(0.5);
  subtitleGlow.y = subtitleBaseY;
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
  labelGhostR.y = labelBaseY;
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
  labelGhostC.y = labelBaseY;
  labelGhostC.alpha = 0;
  medalRoot.addChild(labelGhostC);

  const shadowTopInner = 6;
  const shadowTopOuter = -2;
  const shadowBottom = subtitleBaseY + subtitle.height / 2 + 50;
  const shadowInnerHeight = Math.max(156, shadowBottom - shadowTopInner);
  const shadowOuterHeight = Math.max(172, shadowBottom + 18 - shadowTopOuter);
  coldShadow.clear();
  coldShadow.beginFill(0x000000, 1);
  coldShadow.drawRoundedRect(ribbonX - 16, shadowTopInner, ribbonWidth + 32, shadowInnerHeight, 38);
  coldShadow.endFill();
  coldShadow.beginFill(0x000000, 0.8);
  coldShadow.drawRoundedRect(ribbonX - 26, shadowTopOuter, ribbonWidth + 52, shadowOuterHeight, 46);
  coldShadow.endFill();

  return {
    medalRoot,
    coldShadow,
    keyLight,
    glowSweep,
    ribbonWidth,
    effectWidth: ribbonWidth + 96,
    effectHeight: Math.max(260, shadowOuterHeight + coldShadow.y + 24),
    labelBaseY,
    titleBaseY,
    subtitleBaseY,
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
