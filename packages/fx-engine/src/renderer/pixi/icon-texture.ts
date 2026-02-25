import { Sprite, Texture } from 'pixi.js';
import type {
  FxBuiltinIconKey,
  FxIconInput,
  FxRarity,
  FxRegisteredIconSource,
} from '../../types';
import { __iconNode as starIconNode } from 'lucide-react/dist/esm/icons/star.js';
import { __iconNode as shieldIconNode } from 'lucide-react/dist/esm/icons/shield.js';
import { __iconNode as ribbonIconNode } from 'lucide-react/dist/esm/icons/ribbon.js';
import { __iconNode as trophyIconNode } from 'lucide-react/dist/esm/icons/trophy.js';

type LucideIconNode = [string, Record<string, string | number>][];
type LucideDynamicIconModule = {
  __iconNode?: LucideIconNode;
};
type LucideDynamicIconImporter = () => Promise<LucideDynamicIconModule>;
type LucideDynamicIconImports = Record<string, LucideDynamicIconImporter>;

const BUILTIN_ICON_NODES: Record<FxBuiltinIconKey, LucideIconNode> = {
  star: starIconNode as LucideIconNode,
  shield: shieldIconNode as LucideIconNode,
  ribbon: ribbonIconNode as LucideIconNode,
  trophy: trophyIconNode as LucideIconNode,
};

const ICON_VIEWBOX_SIZE = 24;
const ICON_TEXTURE_SIZE = 96;
const DEFAULT_STROKE = '#20242b';
const LUCIDE_TOKEN_PREFIX = 'lucide:';

let lucideDynamicIconImportsPromise: Promise<LucideDynamicIconImports> | null = null;

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

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

function asSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function parseSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = svg.match(/\bviewBox\s*=\s*['"]\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s*['"]/i);
  if (!match) return null;
  const width = Number.parseFloat(match[1] ?? '');
  const height = Number.parseFloat(match[2] ?? '');
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function normalizeSvgMarkup(svg: string): string {
  const normalized = svg.trim();
  const openTagMatch = normalized.match(/^<svg\b[^>]*>/i);
  if (!openTagMatch) return normalized;

  const openTag = openTagMatch[0];
  const hasWidth = /\bwidth\s*=/.test(openTag);
  const hasHeight = /\bheight\s*=/.test(openTag);
  const hasPreserveAspectRatio = /\bpreserveAspectRatio\s*=/.test(openTag);
  if (hasWidth && hasHeight && hasPreserveAspectRatio) {
    return normalized;
  }

  const viewBox = parseSvgViewBox(openTag);
  const width = viewBox?.width ?? ICON_VIEWBOX_SIZE;
  const height = viewBox?.height ?? ICON_VIEWBOX_SIZE;

  const attrs: string[] = [];
  if (!hasWidth) attrs.push(`width="${width}"`);
  if (!hasHeight) attrs.push(`height="${height}"`);
  if (!hasPreserveAspectRatio) attrs.push('preserveAspectRatio="xMidYMid meet"');
  if (attrs.length === 0) return normalized;

  const updatedOpenTag = openTag.replace(/^<svg\b/i, `<svg ${attrs.join(' ')}`);
  return `${updatedOpenTag}${normalized.slice(openTag.length)}`;
}

function isUrlToken(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isSvgToken(value: string): boolean {
  return /^\s*<svg[\s>]/i.test(value);
}

function resolveBuiltinFromToken(token: string): FxBuiltinIconKey | null {
  const lowered = token.toLowerCase();
  if (lowered.includes('trophy') || lowered.includes('cup')) return 'trophy';
  if (lowered.includes('shield')) return 'shield';
  if (lowered.includes('ribbon') || lowered.includes('medal')) return 'ribbon';
  if (lowered.includes('star')) return 'star';
  return null;
}

function normalizeLucideIconName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.toLowerCase().startsWith(LUCIDE_TOKEN_PREFIX)
    ? trimmed.slice(LUCIDE_TOKEN_PREFIX.length)
    : trimmed;

  return withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function resolveLucideFromToken(token: string): string | null {
  if (!token.toLowerCase().startsWith(LUCIDE_TOKEN_PREFIX)) return null;
  const normalized = normalizeLucideIconName(token);
  return normalized.length > 0 ? normalized : null;
}

function buildLucideLookupCandidates(name: string): string[] {
  const variants = [name, normalizeLucideIconName(name)]
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
  return [...new Set(variants)];
}

async function getLucideDynamicIconImports(): Promise<LucideDynamicIconImports> {
  if (!lucideDynamicIconImportsPromise) {
    lucideDynamicIconImportsPromise = import('lucide-react/dynamicIconImports')
      .then((module) => (module.default ?? module) as LucideDynamicIconImports)
      .catch((error) => {
        lucideDynamicIconImportsPromise = null;
        throw error;
      });
  }
  return lucideDynamicIconImportsPromise;
}

function fallbackBuiltinKey(rarity: FxRarity): FxBuiltinIconKey {
  if (rarity === 'legendary') return 'trophy';
  if (rarity === 'epic') return 'ribbon';
  if (rarity === 'rare') return 'shield';
  return 'star';
}

function waitForTexture(texture: Texture): Promise<Texture> {
  if (texture.valid || texture.baseTexture.valid) return Promise.resolve(texture);
  const baseTexture = texture.baseTexture;
  return new Promise<Texture>((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve(texture);
    };
    const onError = () => {
      cleanup();
      reject(new Error('Failed to load icon texture'));
    };
    const cleanup = () => {
      baseTexture.off('loaded', onLoaded);
      baseTexture.off('error', onError);
    };
    baseTexture.once('loaded', onLoaded);
    baseTexture.once('error', onError);
  });
}

export interface IconResolver {
  registerIcon(key: string, source: FxRegisteredIconSource): void;
  registerIcons(icons: Record<string, FxRegisteredIconSource>): void;
  createIconSprite(rarity: FxRarity, icon?: FxIconInput): Promise<Sprite>;
  dispose(): void;
}

class PixiIconResolver implements IconResolver {
  private readonly textureCache = new Map<string, Texture>();
  private readonly inflightCache = new Map<string, Promise<Texture>>();
  private readonly iconLibrary = new Map<string, FxRegisteredIconSource>();

  registerIcon(key: string, source: FxRegisteredIconSource): void {
    const trimmed = key.trim();
    if (!trimmed) return;
    this.iconLibrary.set(trimmed, source);
  }

  registerIcons(icons: Record<string, FxRegisteredIconSource>): void {
    for (const [key, source] of Object.entries(icons)) {
      this.registerIcon(key, source);
    }
  }

  async createIconSprite(rarity: FxRarity, icon?: FxIconInput): Promise<Sprite> {
    let texture: Texture;
    try {
      texture = await this.resolveIconTexture(rarity, icon);
    } catch {
      texture = await this.getBuiltinTexture(fallbackBuiltinKey(rarity), DEFAULT_STROKE);
    }

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.y = -2;
    sprite.roundPixels = true;
    const iconSize = rarity === 'legendary' ? 46 : rarity === 'epic' ? 44 : 40;
    sprite.width = iconSize;
    sprite.height = iconSize;
    return sprite;
  }

  dispose(): void {
    for (const inflight of this.inflightCache.values()) {
      void inflight.catch(() => undefined);
    }
    this.inflightCache.clear();

    for (const texture of this.textureCache.values()) {
      texture.destroy(true);
    }
    this.textureCache.clear();
    this.iconLibrary.clear();
  }

  private async loadWithCache(cacheKey: string, loader: () => Texture | Promise<Texture>): Promise<Texture> {
    const cached = this.textureCache.get(cacheKey);
    if (cached) {
      try {
        return await waitForTexture(cached);
      } catch {
        this.textureCache.delete(cacheKey);
        cached.destroy(true);
      }
    }

    const inflight = this.inflightCache.get(cacheKey);
    if (inflight) return inflight;

    const promise = (async () => {
      const texture = await loader();
      try {
        const readyTexture = await waitForTexture(texture);
        this.textureCache.set(cacheKey, readyTexture);
        return readyTexture;
      } catch (error) {
        this.textureCache.delete(cacheKey);
        texture.destroy(true);
        throw error;
      }
    })();

    this.inflightCache.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inflightCache.delete(cacheKey);
    }
  }

  private async getBuiltinTexture(iconKey: FxBuiltinIconKey, strokeHex: string): Promise<Texture> {
    const cacheKey = `builtin:${iconKey}:${strokeHex}`;
    return this.loadWithCache(cacheKey, () => {
      const svg = iconNodeToSvg(BUILTIN_ICON_NODES[iconKey], strokeHex);
      return Texture.from(asSvgDataUri(svg), {
        resourceOptions: {
          autoLoad: true,
          width: ICON_TEXTURE_SIZE,
          height: ICON_TEXTURE_SIZE,
        },
      });
    });
  }

  private async getSvgTexture(svg: string, cacheKey?: string): Promise<Texture> {
    const normalized = normalizeSvgMarkup(svg);
    if (!isSvgToken(normalized)) {
      throw new Error('Invalid SVG icon source');
    }
    const resolvedKey = cacheKey ? `svg:${cacheKey}` : `svg:${stableHash(normalized)}`;
    return this.loadWithCache(resolvedKey, () =>
      Texture.from(asSvgDataUri(normalized), {
        resourceOptions: {
          autoLoad: true,
          width: ICON_TEXTURE_SIZE,
          height: ICON_TEXTURE_SIZE,
        },
      }),
    );
  }

  private async getUrlTexture(url: string, cacheKey?: string): Promise<Texture> {
    const resolvedKey = cacheKey ? `url:${cacheKey}` : `url:${url}`;
    return this.loadWithCache(resolvedKey, () => Texture.from(url));
  }

  private async getLucideTexture(name: string, strokeHex: string, cacheKey?: string): Promise<Texture> {
    const imports = await getLucideDynamicIconImports();
    const candidates = buildLucideLookupCandidates(name);
    const resolvedName = candidates.find((candidate) => typeof imports[candidate] === 'function');
    if (!resolvedName) {
      throw new Error(`Unknown Lucide icon: ${name}`);
    }

    const importer = imports[resolvedName];
    const resolvedKey = cacheKey
      ? `lucide:${cacheKey}:${strokeHex}`
      : `lucide:${resolvedName}:${strokeHex}`;

    return this.loadWithCache(resolvedKey, async () => {
      const module = await importer();
      if (!module.__iconNode) {
        throw new Error(`Lucide icon node missing: ${resolvedName}`);
      }
      const svg = iconNodeToSvg(module.__iconNode, strokeHex);
      return Texture.from(asSvgDataUri(svg), {
        resourceOptions: {
          autoLoad: true,
          width: ICON_TEXTURE_SIZE,
          height: ICON_TEXTURE_SIZE,
        },
      });
    });
  }

  private normalizeIconSource(rarity: FxRarity, icon?: FxIconInput): FxRegisteredIconSource {
    if (!icon) {
      return { type: 'builtin', key: fallbackBuiltinKey(rarity) };
    }

    if (typeof icon === 'string') {
      const token = icon.trim();
      if (token.length === 0) {
        return { type: 'builtin', key: fallbackBuiltinKey(rarity) };
      }
      const registered = this.iconLibrary.get(token);
      if (registered) return registered;
      if (isSvgToken(token)) return { type: 'svg', svg: token };
      if (isUrlToken(token)) return { type: 'url', url: token };
      const lucideName = resolveLucideFromToken(token);
      if (lucideName) return { type: 'lucide', name: lucideName };
      const builtin = resolveBuiltinFromToken(token);
      if (builtin) return { type: 'builtin', key: builtin };
      return { type: 'builtin', key: fallbackBuiltinKey(rarity) };
    }

    if (icon.type === 'library') {
      const registered = this.iconLibrary.get(icon.key);
      if (registered) return registered;
      return { type: 'builtin', key: fallbackBuiltinKey(rarity) };
    }

    return icon;
  }

  private async resolveIconTexture(rarity: FxRarity, icon?: FxIconInput): Promise<Texture> {
    const source = this.normalizeIconSource(rarity, icon);
    switch (source.type) {
      case 'builtin':
        return this.getBuiltinTexture(source.key, DEFAULT_STROKE);
      case 'svg':
        return this.getSvgTexture(source.svg, source.cacheKey);
      case 'url':
        return this.getUrlTexture(source.url, source.cacheKey);
      case 'lucide':
        return this.getLucideTexture(source.name, DEFAULT_STROKE, source.cacheKey);
      default:
        return this.getBuiltinTexture(fallbackBuiltinKey(rarity), DEFAULT_STROKE);
    }
  }
}

export function createIconResolver(): IconResolver {
  return new PixiIconResolver();
}
