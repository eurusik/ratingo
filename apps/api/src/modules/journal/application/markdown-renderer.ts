import * as he from 'he';

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
  sanitize(html: string, options?: SanitizeOptions): string;
}

export interface SanitizeOptions {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOW_DATA_ATTR?: boolean;
}

/**
 * Cached marked module (lazy-loaded ESM).
 */
let cachedMarked: MarkedModule | null = null;

/**
 * Gets the marked module, loading it lazily.
 */
async function getMarked(): Promise<MarkedModule> {
  if (!cachedMarked) {
    cachedMarked = (await import('marked')) as unknown as MarkedModule;
  }
  return cachedMarked;
}

/**
 * Default sanitizer using isomorphic-dompurify.
 * Lazy-loaded to avoid ESM issues in tests.
 */
let cachedSanitizer: HtmlSanitizer | null = null;

/**
 * Gets the DOMPurify sanitizer, loading it lazily.
 */
export async function getSanitizer(): Promise<HtmlSanitizer> {
  if (!cachedSanitizer) {
    const DOMPurify = await import('isomorphic-dompurify');
    cachedSanitizer = DOMPurify.default;
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
    if (
      href &&
      !href.startsWith('http://') &&
      !href.startsWith('https://') &&
      !href.startsWith('/')
    ) {
      return text;
    }

    const isExternal = href?.startsWith('http');
    const relAttr = isExternal ? ' rel="nofollow noopener noreferrer"' : '';
    const targetAttr = isExternal ? ' target="_blank"' : '';
    const titleAttr = title ? ` title="${title}"` : '';

    return `<a href="${href}"${relAttr}${targetAttr}${titleAttr}>${text}</a>`;
  };

  renderer.image = ({ href, title, text }): string => {
    // Only allow http/https protocols and relative paths
    if (
      href &&
      !href.startsWith('http://') &&
      !href.startsWith('https://') &&
      !href.startsWith('/')
    ) {
      return '';
    }

    const titleAttr = title ? ` title="${title}"` : '';
    return `<img src="${href}" alt="${text}"${titleAttr} loading="lazy" decoding="async" />`;
  };

  cachedRenderer = renderer;
  return renderer;
}

const SANITIZE_OPTIONS: SanitizeOptions = {
  ALLOWED_TAGS: [
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
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'loading', 'decoding', 'rel', 'target', 'class'],
  ALLOW_DATA_ATTR: false,
};

/**
 * Renders markdown to sanitized HTML.
 * Uses DOMPurify for XSS protection.
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

  return sanitizer.sanitize(html, SANITIZE_OPTIONS);
}

/**
 * Async version of renderMarkdown that lazy-loads DOMPurify.
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

  const sanitizer = await getSanitizer();
  return sanitizer.sanitize(html, SANITIZE_OPTIONS);
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
