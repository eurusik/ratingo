import { BLEND_MODES, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { RarityVisualProfile } from '../../../core/config/rarity-profile';
import { createIconSprite } from '../icon-texture';
import type { AchievementCardNodes } from './types';
import type { AchievementFxEvent, FxRarity } from '../../../types';

interface CreateAchievementCardInput {
  cameraRig: Container;
  event: AchievementFxEvent;
  profile: RarityVisualProfile;
  rarity: FxRarity;
  centerX: number;
  medalY: number;
}

export function createAchievementCard(input: CreateAchievementCardInput): AchievementCardNodes {
  const medalRoot = new Container();
  medalRoot.x = input.centerX;
  medalRoot.y = input.medalY;
  medalRoot.alpha = 0;
  medalRoot.scale.set(0.62);
  input.cameraRig.addChild(medalRoot);

  const ribbon = new Graphics();
  ribbon.beginFill(input.profile.ribbon, 0.95);
  ribbon.drawRoundedRect(-180, -40, 360, 80, 22);
  ribbon.endFill();
  medalRoot.addChild(ribbon);

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
    dropShadow: true,
    dropShadowColor: '#000000',
    dropShadowBlur: 12,
    dropShadowDistance: 0,
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
    dropShadow: true,
    dropShadowColor: '#000000',
    dropShadowBlur: 20,
    dropShadowDistance: 0,
  });
  title.anchor.set(0.5);
  title.y = 126;
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
    fill: 0xa0a5b0,
    align: 'center',
    dropShadow: true,
    dropShadowColor: '#000000',
    dropShadowBlur: 10,
    dropShadowDistance: 0,
  });
  subtitle.anchor.set(0.5);
  subtitle.y = 154;
  subtitle.alpha = input.event.subtitle ? 0.95 : 0;
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
    glowSweep,
    label,
    title,
    subtitle,
    titleGhostR,
    titleGhostC,
    labelGhostR,
    labelGhostC,
  };
}
