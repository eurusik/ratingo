import { Container, Graphics } from 'pixi.js';
import type { AchievementCardNodes } from './types';

interface CreateAchievementMaskInput {
  cameraRig: Container;
  centerX: number;
  medalY: number;
  card: Pick<
    AchievementCardNodes,
    'label' | 'title' | 'subtitle' | 'ribbonWidth' | 'labelBaseY' | 'titleBaseY' | 'subtitleBaseY'
  >;
  maskTargets: Graphics[];
}

export function createAchievementMask(input: CreateAchievementMaskInput): Container {
  const achievementMask = new Container();
  achievementMask.x = input.centerX;
  achievementMask.y = input.medalY;
  achievementMask.scale.set(0.62);
  achievementMask.alpha = 0.001;
  input.cameraRig.addChild(achievementMask);

  const maskRibbon = new Graphics();
  const maskRibbonWidth = input.card.ribbonWidth;
  maskRibbon.beginFill(0xffffff, 1);
  maskRibbon.drawRoundedRect(-maskRibbonWidth / 2, -34, maskRibbonWidth, 68, 14);
  maskRibbon.endFill();
  achievementMask.addChild(maskRibbon);

  const maskMedal = new Graphics();
  maskMedal.beginFill(0xffffff, 1);
  maskMedal.drawCircle(0, 0, 58);
  maskMedal.endFill();
  achievementMask.addChild(maskMedal);

  const maskLabel = new Graphics();
  const labelMaskWidth = Math.max(180, input.card.label.width + 24);
  maskLabel.beginFill(0xffffff, 1);
  maskLabel.drawRoundedRect(-labelMaskWidth / 2, input.card.labelBaseY - 11, labelMaskWidth, 20, 6);
  maskLabel.endFill();
  achievementMask.addChild(maskLabel);

  const maskTitle = new Graphics();
  const titleMaskWidth = Math.max(220, input.card.title.width + 28);
  maskTitle.beginFill(0xffffff, 1);
  maskTitle.drawRoundedRect(-titleMaskWidth / 2, input.card.titleBaseY - 21, titleMaskWidth, 38, 9);
  maskTitle.endFill();
  achievementMask.addChild(maskTitle);

  if (input.card.subtitle.text) {
    const maskSubtitle = new Graphics();
    const subtitleMaskWidth = Math.max(170, input.card.subtitle.width + 26);
    maskSubtitle.beginFill(0xffffff, 1);
    maskSubtitle.drawRoundedRect(
      -subtitleMaskWidth / 2,
      input.card.subtitleBaseY - 11,
      subtitleMaskWidth,
      22,
      6,
    );
    maskSubtitle.endFill();
    achievementMask.addChild(maskSubtitle);
  }

  for (const target of input.maskTargets) {
    target.mask = achievementMask;
  }

  return achievementMask;
}
