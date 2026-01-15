/**
 * Markdown to HTML and HTML to Markdown converters.
 */

import TurndownService from 'turndown';

/**
 * Convert markdown to HTML for WYSIWYG editor.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  return (
    markdown
      // Code blocks (must be before inline code)
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold and italic (order matters)
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Images (before links)
      .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
      // Links
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<ul><li>$1</li></ul>')
      // Ordered lists
      .replace(/^(\d+)\. (.+)$/gm, '<ol><li>$2</li></ol>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr />')
      // Paragraphs (double newlines)
      .replace(/\n\n+/g, '</p><p>')
      // Single newlines to br
      .replace(/\n/g, '<br />')
  );
}

/**
 * Convert HTML to markdown for markdown editor.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // Custom rule for images
  turndownService.addRule('images', {
    filter: 'img',
    replacement: (_content, node) => {
      const element = node as HTMLImageElement;
      const alt = element.getAttribute('alt') || 'image';
      const src = element.getAttribute('src') || '';
      return `![${alt}](${src})`;
    },
  });

  return turndownService.turndown(html);
}
