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
  const ribbonWidth = Math.max(248, Math.min(344, input.viewportWidth - 124));
  const ribbonHeight = 68;
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
  coldShadow.drawRoundedRect(ribbonX - 12, 8, ribbonWidth + 24, 166, 30);
  coldShadow.endFill();
  coldShadow.beginFill(0x000000, 0.8);
  coldShadow.drawRoundedRect(ribbonX - 20, 0, ribbonWidth + 40, 182, 36);
  coldShadow.endFill();
  coldShadow.y = 26;
  coldShadow.blendMode = BLEND_MODES.MULTIPLY;
  coldShadow.alpha = 0;
  medalRoot.addChild(coldShadow);

  const ribbon = new Graphics();
  ribbon.beginFill(input.profile.ribbon, 0.99);
  ribbon.drawRoundedRect(ribbonX, -34, ribbonWidth, ribbonHeight, 14);
  ribbon.endFill();
  medalRoot.addChild(ribbon);

  const keyLight = new Graphics();
  keyLight.beginFill(0x4ea1ff, 0.28);
  keyLight.drawRoundedRect(ribbonX - 8, -42, ribbonWidth + 16, 32, 12);
  keyLight.endFill();
  keyLight.beginFill(0xd8e8f7, 0.16);
  keyLight.drawRoundedRect(ribbonX + 30, -38, ribbonWidth - 60, 20, 8);
  keyLight.endFill();
  keyLight.blendMode = BLEND_MODES.ADD;
  keyLight.alpha = 0;
  medalRoot.addChild(keyLight);

  const medal = new Graphics();
  medal.beginFill(input.profile.medalFill, 1);
  medal.drawCircle(0, 0, 56);
  medal.endFill();
  medal.lineStyle(3, input.profile.medalStroke, 0.92);
  medal.drawCircle(0, 0, 53);
  medalRoot.addChild(medal);

  const iconSprite = createIconSprite(input.rarity, input.event.icon);
  medalRoot.addChild(iconSprite);

  const glowSweep = new Graphics();
  glowSweep.beginFill(0xc7d3df, 0.08);
  glowSweep.drawRoundedRect(-28, -62, 56, 124, 10);
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
    fontSize: input.rarity === 'legendary' ? 26 : input.rarity === 'epic' ? 28 : 24,
    fontWeight: '700',
    fill: input.profile.titleColor,
    align: 'center',
    stroke: '#000000',
    strokeThickness: 1.5,
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 110),
  });
  title.anchor.set(0.5);
  title.y = titleBaseY;

  const titleGlow = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 26 : input.rarity === 'epic' ? 28 : 24,
    fontWeight: '700',
    fill: input.profile.titleColor,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 110),
  });
  titleGlow.anchor.set(0.5);
  titleGlow.y = titleBaseY;
  titleGlow.alpha = 0;
  titleGlow.filters = [new BlurFilter(6)];
  titleGlow.blendMode = BLEND_MODES.SCREEN;
  medalRoot.addChild(titleGlow);
  medalRoot.addChild(title);

  const titleGhostR = new Text(input.event.title, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: input.rarity === 'legendary' ? 26 : input.rarity === 'epic' ? 28 : 24,
    fontWeight: '700',
    fill: 0xc38e8e,
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
    fontSize: input.rarity === 'legendary' ? 26 : input.rarity === 'epic' ? 28 : 24,
    fontWeight: '700',
    fill: 0x84afc2,
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
    fontSize: 13,
    fontWeight: '600',
    fill: 0xc3cad7,
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
    fontSize: 13,
    fontWeight: '600',
    fill: 0xe0e6ef,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Math.min(520, ribbonWidth + 90),
  });
  subtitleGlow.anchor.set(0.5);
  subtitleGlow.y = subtitleBaseY;
  subtitleGlow.alpha = 0;
  subtitleGlow.filters = [new BlurFilter(4)];
  subtitleGlow.blendMode = BLEND_MODES.SCREEN;
  medalRoot.addChild(subtitleGlow);
  medalRoot.addChild(subtitle);

  const labelGhostR = new Text(label.text, {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.8,
    fill: 0xbc9292,
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
    fill: 0x86adc0,
    align: 'center',
  });
  labelGhostC.anchor.set(0.5);
  labelGhostC.y = labelBaseY;
  labelGhostC.alpha = 0;
  medalRoot.addChild(labelGhostC);

  const shadowTopInner = 6;
  const shadowTopOuter = 0;
  const shadowBottom = subtitleBaseY + subtitle.height / 2 + 34;
  const shadowInnerHeight = Math.max(136, shadowBottom - shadowTopInner);
  const shadowOuterHeight = Math.max(148, shadowBottom + 12 - shadowTopOuter);
  coldShadow.clear();
  coldShadow.beginFill(0x000000, 1);
  coldShadow.drawRoundedRect(ribbonX - 12, shadowTopInner, ribbonWidth + 24, shadowInnerHeight, 30);
  coldShadow.endFill();
  coldShadow.beginFill(0x000000, 0.8);
  coldShadow.drawRoundedRect(ribbonX - 20, shadowTopOuter, ribbonWidth + 40, shadowOuterHeight, 36);
  coldShadow.endFill();

  return {
    medalRoot,
    coldShadow,
    keyLight,
    glowSweep,
    ribbonWidth,
    effectWidth: ribbonWidth + 80,
    effectHeight: Math.max(240, shadowOuterHeight + coldShadow.y + 18),
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
