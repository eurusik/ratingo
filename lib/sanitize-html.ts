import DOMPurify from 'dompurify';

/**
 * Очистити HTML контент
 * та видалити Tiptap артефакти
 */
export function sanitizeHtml(html: string): string {
  // Спочатку видалити Tiptap артефакти
  let cleaned = html.replace(/<br class="ProseMirror-trailingBreak"><\/br>/g, '<br>');
  cleaned = cleaned.replace(/<br class="ProseMirror-trailingBreak">/g, '<br>');
  cleaned = cleaned.replace(/\s*data-placeholder="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s*class="is-empty"/g, '');

  // Потім санітайзити з DOMPurify
  return DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'b',
      'i',
      'em',
      'strong',
      'u',
      's',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'img',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: ['href', 'src', 'class', 'alt', 'title'],
    KEEP_CONTENT: true,
  });
}
