import * as he from 'he';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html') as typeof import('sanitize-html');

/**
 * URL protocol constants for security validation.
 */
const ALLOWED_PROTOCOLS = {
  HTTP: 'http://',
  HTTPS: 'https://',
  RELATIVE: '/',
} as const;

/**
 * HTML attribute values for external links.
 */
const EXTERNAL_LINK_ATTRS = {
  REL: 'nofollow noopener noreferrer',
  TARGET: '_blank',
} as const;

/**
 * Image loading attributes.
 */
const IMAGE_ATTRS = {
  LOADING: 'lazy',
  DECODING: 'async',
} as const;

/**
 * Marked module type for lazy loading.
 */
interface MarkedModule {
  marked: {
    parse: (markdown: string, options?: Record<string, unknown>) => string;
  };
  Renderer: new () => MarkedRenderer;
}

interface MarkedRenderer {
  link: (token: { href: string; title?: string; text: string }) => string;
  image: (token: { href: string; title?: string; text: string }) => string;
}

/**
 * Sanitizer interface for HTML sanitization.
 */
export interface HtmlSanitizer {
  sanitize(html: string): string;
}

/**
 * Dynamic import helper to prevent TypeScript from transforming to require().
 * This is needed because marked is ESM-only and NestJS uses CommonJS.
 */
const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (
  modulePath: string,
) => Promise<unknown>;

/**
 * Cached marked module (lazy-loaded ESM).
 */
let cachedMarked: MarkedModule | null = null;

/**
 * Gets the marked module, loading it lazily.
 */
async function getMarked(): Promise<MarkedModule> {
  if (!cachedMarked) {
    cachedMarked = (await dynamicImport('marked')) as MarkedModule;
  }
  return cachedMarked;
}

/**
 * Sanitize options for sanitize-html.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'p',
    'a',
    'img',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'code',
    'pre',
    'blockquote',
    'hr',
    'br',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'loading', 'decoding'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https'],
};

/**
 * Default sanitizer using sanitize-html.
 */
let cachedSanitizer: HtmlSanitizer | null = null;

/**
 * Gets the sanitizer instance.
 */
export function getSanitizer(): HtmlSanitizer {
  if (!cachedSanitizer) {
    cachedSanitizer = {
      sanitize: (html: string) => sanitizeHtml(html, SANITIZE_OPTIONS),
    };
  }
  return cachedSanitizer;
}

/**
 * Sets a custom sanitizer (for testing).
 */
export function setSanitizer(sanitizer: HtmlSanitizer | null): void {
  cachedSanitizer = sanitizer;
}

/**
 * Cached secure renderer instance.
 */
let cachedRenderer: MarkedRenderer | null = null;

/**
 * Creates a custom renderer for secure markdown rendering.
 * - Only allows http/https protocols for links and images
 * - Adds rel="nofollow noopener noreferrer" to external links
 * - Adds lazy loading to images
 */
async function getSecureRenderer(): Promise<MarkedRenderer> {
  if (cachedRenderer) {
    return cachedRenderer;
  }

  const { Renderer } = await getMarked();
  const renderer = new Renderer();

  renderer.link = ({ href, title, text }): string => {
    // Only allow http/https protocols and relative paths
    const isAllowedProtocol =
      !href ||
      href.startsWith(ALLOWED_PROTOCOLS.HTTP) ||
      href.startsWith(ALLOWED_PROTOCOLS.HTTPS) ||
      href.startsWith(ALLOWED_PROTOCOLS.RELATIVE);

    if (!isAllowedProtocol) {
      return text;
    }

    const isExternal = href?.startsWith(ALLOWED_PROTOCOLS.HTTP);
    const relAttr = isExternal ? ` rel="${EXTERNAL_LINK_ATTRS.REL}"` : '';
    const targetAttr = isExternal ? ` target="${EXTERNAL_LINK_ATTRS.TARGET}"` : '';
    const titleAttr = title ? ` title="${title}"` : '';

    return `<a href="${href}"${relAttr}${targetAttr}${titleAttr}>${text}</a>`;
  };

  renderer.image = ({ href, title, text }): string => {
    // Only allow http/https protocols and relative paths
    const isAllowedProtocol =
      !href ||
      href.startsWith(ALLOWED_PROTOCOLS.HTTP) ||
      href.startsWith(ALLOWED_PROTOCOLS.HTTPS) ||
      href.startsWith(ALLOWED_PROTOCOLS.RELATIVE);

    if (!isAllowedProtocol) {
      return '';
    }

    const titleAttr = title ? ` title="${title}"` : '';
    return `<img src="${href}" alt="${text}"${titleAttr} loading="${IMAGE_ATTRS.LOADING}" decoding="${IMAGE_ATTRS.DECODING}" />`;
  };

  cachedRenderer = renderer;
  return renderer;
}

/**
 * Renders markdown to sanitized HTML.
 *
 * @param markdown - Raw markdown content
 * @param sanitizer - Custom sanitizer (for testing)
 * @returns Promise resolving to sanitized HTML string
 */
export async function renderMarkdown(markdown: string, sanitizer: HtmlSanitizer): Promise<string> {
  const { marked } = await getMarked();
  const renderer = await getSecureRenderer();

  const html = marked.parse(markdown, {
    gfm: true,
    breaks: true,
    renderer,
  }) as string;

  return sanitizer.sanitize(html);
}

/**
 * Renders markdown to sanitized HTML using default sanitizer.
 *
 * @param markdown - Raw markdown content
 * @returns Promise resolving to sanitized HTML string
 */
export async function renderMarkdownAsync(markdown: string): Promise<string> {
  const { marked } = await getMarked();
  const renderer = await getSecureRenderer();

  const html = marked.parse(markdown, {
    gfm: true,
    breaks: true,
    renderer,
  }) as string;

  const sanitizer = getSanitizer();
  return sanitizer.sanitize(html);
}

/**
 * Generates a plain text excerpt from markdown content.
 * Strips HTML tags and decodes HTML entities.
 *
 * @param markdown - Raw markdown content
 * @param maxLength - Maximum length of excerpt (default: 200)
 * @returns Promise resolving to plain text excerpt
 */
export async function generateExcerpt(markdown: string, maxLength = 200): Promise<string> {
  const { marked } = await getMarked();
  const html = marked.parse(markdown, { gfm: true }) as string;

  // Strip HTML tags and decode entities
  const plainText = he
    .decode(
      html
        .replace(/<[^>]+>/g, '') // Strip HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim(),
    )
    .replace(/\u00A0/g, ' ') // Convert non-breaking spaces to regular spaces
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Truncate at word boundary
  const truncated = plainText.substring(0, maxLength).replace(/\s+\S*$/, '');
  return `${truncated}…`;
}
