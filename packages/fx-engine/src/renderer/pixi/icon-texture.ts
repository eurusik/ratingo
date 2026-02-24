import { Sprite, Texture } from 'pixi.js';
import type { FxRarity } from '../../types';
import { __iconNode as starIconNode } from 'lucide-react/dist/esm/icons/star.js';
import { __iconNode as shieldIconNode } from 'lucide-react/dist/esm/icons/shield.js';
import { __iconNode as ribbonIconNode } from 'lucide-react/dist/esm/icons/ribbon.js';
import { __iconNode as trophyIconNode } from 'lucide-react/dist/esm/icons/trophy.js';

type LucideIconNode = [string, Record<string, string | number>][];

type IconKey = 'star' | 'shield' | 'ribbon' | 'trophy';

const ICON_NODES: Record<IconKey, LucideIconNode> = {
  star: starIconNode as LucideIconNode,
  shield: shieldIconNode as LucideIconNode,
  ribbon: ribbonIconNode as LucideIconNode,
  trophy: trophyIconNode as LucideIconNode,
};

const ICON_TEXTURE_CACHE = new Map<string, Texture>();
const ICON_VIEWBOX_SIZE = 24;
const ICON_TEXTURE_SIZE = 96;

function iconNodeToSvg(iconNode: LucideIconNode, strokeHex: string): string {
  const nodes = iconNode
    .map(([tag, attrs]) => {
      const attrsString = Object.entries(attrs)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(' ');
      return `<${tag} ${attrsString} />`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_VIEWBOX_SIZE}" height="${ICON_VIEWBOX_SIZE}" viewBox="0 0 ${ICON_VIEWBOX_SIZE} ${ICON_VIEWBOX_SIZE}" fill="none" stroke="${strokeHex}" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">${nodes}</svg>`;
}

function getIconTexture(iconKey: IconKey, strokeHex: string): Texture {
  const cacheKey = `${iconKey}:${strokeHex}`;
  const cached = ICON_TEXTURE_CACHE.get(cacheKey);
  if (cached) return cached;

  const svg = iconNodeToSvg(ICON_NODES[iconKey], strokeHex);
  const texture = Texture.from(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, {
    resourceOptions: {
      autoLoad: true,
      width: ICON_TEXTURE_SIZE,
      height: ICON_TEXTURE_SIZE,
    },
  });
  ICON_TEXTURE_CACHE.set(cacheKey, texture);
  return texture;
}

function resolveIconKey(rarity: FxRarity, icon?: string): IconKey {
  const token = (icon ?? '').toLowerCase();
  if (token.includes('trophy') || token.includes('cup')) return 'trophy';
  if (token.includes('shield')) return 'shield';
  if (token.includes('ribbon') || token.includes('medal')) return 'ribbon';
  if (token.includes('star')) return 'star';

  if (rarity === 'legendary') return 'trophy';
  if (rarity === 'epic') return 'ribbon';
  if (rarity === 'rare') return 'shield';
  return 'star';
}

export function createIconSprite(rarity: FxRarity, icon?: string): Sprite {
  const iconKey = resolveIconKey(rarity, icon);
  const texture = getIconTexture(iconKey, '#20242b');
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.y = -2;
  sprite.roundPixels = true;
  const iconSize = rarity === 'legendary' ? 46 : rarity === 'epic' ? 44 : 40;
  sprite.width = iconSize;
  sprite.height = iconSize;
  return sprite;
}
