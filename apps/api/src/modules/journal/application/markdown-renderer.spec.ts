import { generateExcerpt, HtmlSanitizer, renderMarkdown } from './markdown-renderer';

/**
 * Mock sanitizer for testing that provides basic XSS protection.
 */
const mockSanitizer: HtmlSanitizer = {
  sanitize: (html: string, options?: { ALLOWED_TAGS?: string[] }) => {
    if (!html) return '';

    let result = html
      // Remove script tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove style tags
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove iframe tags
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      // Remove event handlers (onclick, onerror, etc.)
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

    // Filter allowed tags if specified
    if (options?.ALLOWED_TAGS) {
      const allowedTags = options.ALLOWED_TAGS;
      const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
      result = result.replace(tagPattern, (match, tagName) => {
        if (allowedTags.includes(tagName.toLowerCase())) {
          return match;
        }
        return '';
      });
    }

    return result;
  },
};

describe('renderMarkdown', () => {
  describe('basic rendering', () => {
    it('should render headings', () => {
      const result = renderMarkdown('# Hello World', mockSanitizer);
      expect(result).toContain('<h1>Hello World</h1>');
    });

    it('should render paragraphs', () => {
      const result = renderMarkdown('This is a paragraph.', mockSanitizer);
      expect(result).toContain('<p>This is a paragraph.</p>');
    });

    it('should render bold and italic', () => {
      const result = renderMarkdown('**bold** and *italic*', mockSanitizer);
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should render lists', () => {
      const result = renderMarkdown('- item 1\n- item 2', mockSanitizer);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item 1</li>');
      expect(result).toContain('<li>item 2</li>');
    });

    it('should render code blocks', () => {
      const result = renderMarkdown('`inline code`', mockSanitizer);
      expect(result).toContain('<code>inline code</code>');
    });
  });

  describe('XSS prevention', () => {
    it('should strip javascript: links', () => {
      const result = renderMarkdown('[click me](javascript:alert("xss"))', mockSanitizer);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('href');
      expect(result).toContain('click me');
    });

    it('should strip data: URIs in links', () => {
      const result = renderMarkdown(
        '[click](data:text/html,<script>alert(1)</script>)',
        mockSanitizer,
      );
      expect(result).not.toContain('data:');
      expect(result).not.toContain('<script>');
    });

    it('should strip javascript: in images', () => {
      const result = renderMarkdown('![alt](javascript:alert("xss"))', mockSanitizer);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('<img');
    });

    it('should strip script tags', () => {
      const result = renderMarkdown('<script>alert("xss")</script>', mockSanitizer);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should strip onclick attributes', () => {
      const result = renderMarkdown('<a href="#" onclick="alert(1)">click</a>', mockSanitizer);
      expect(result).not.toContain('onclick');
    });

    it('should strip onerror attributes on images', () => {
      const result = renderMarkdown('<img src="x" onerror="alert(1)">', mockSanitizer);
      expect(result).not.toContain('onerror');
    });
  });

  describe('external links', () => {
    it('should add rel="nofollow noopener noreferrer" to external links', () => {
      const result = renderMarkdown('[Google](https://google.com)', mockSanitizer);
      expect(result).toContain('rel="nofollow noopener noreferrer"');
      expect(result).toContain('target="_blank"');
    });

    it('should not add rel to internal links', () => {
      const result = renderMarkdown('[Home](/home)', mockSanitizer);
      expect(result).not.toContain('rel=');
      expect(result).not.toContain('target=');
      expect(result).toContain('href="/home"');
    });

    it('should handle http links as external', () => {
      const result = renderMarkdown('[Site](http://example.com)', mockSanitizer);
      expect(result).toContain('rel="nofollow noopener noreferrer"');
    });
  });

  describe('images', () => {
    it('should add lazy loading attribute', () => {
      const result = renderMarkdown('![alt text](https://example.com/image.jpg)', mockSanitizer);
      expect(result).toContain('loading="lazy"');
      expect(result).toContain('decoding="async"');
    });

    it('should preserve alt text', () => {
      const result = renderMarkdown('![My Image](https://example.com/img.png)', mockSanitizer);
      expect(result).toContain('alt="My Image"');
    });

    it('should allow relative image paths', () => {
      const result = renderMarkdown('![alt](/images/photo.jpg)', mockSanitizer);
      expect(result).toContain('src="/images/photo.jpg"');
    });
  });

  describe('allowed tags', () => {
    it('should allow blockquotes', () => {
      const result = renderMarkdown('> This is a quote', mockSanitizer);
      expect(result).toContain('<blockquote>');
    });

    it('should allow horizontal rules', () => {
      const result = renderMarkdown('---', mockSanitizer);
      expect(result).toContain('<hr');
    });

    it('should strip disallowed tags like iframe', () => {
      const result = renderMarkdown('<iframe src="https://evil.com"></iframe>', mockSanitizer);
      expect(result).not.toContain('<iframe');
    });

    it('should strip style tags', () => {
      const result = renderMarkdown('<style>body { display: none; }</style>', mockSanitizer);
      expect(result).not.toContain('<style');
    });
  });
});

describe('generateExcerpt', () => {
  it('should return full text if shorter than maxLength', () => {
    const result = generateExcerpt('Short text', 200);
    expect(result).toBe('Short text');
  });

  it('should truncate at word boundary', () => {
    const longText = 'This is a very long text that should be truncated at a word boundary';
    const result = generateExcerpt(longText, 30);
    expect(result.length).toBeLessThanOrEqual(31); // 30 + ellipsis
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/\s…$/); // No trailing space before ellipsis
  });

  it('should strip HTML tags', () => {
    const result = generateExcerpt('**Bold** and *italic* text', 200);
    expect(result).toBe('Bold and italic text');
  });

  it('should decode HTML entities', () => {
    const result = generateExcerpt('Hello &amp; World', 200);
    expect(result).toBe('Hello & World');
  });

  it('should handle &nbsp; entities', () => {
    const result = generateExcerpt('Hello&nbsp;World', 200);
    expect(result).toBe('Hello World');
  });

  it('should normalize whitespace', () => {
    const result = generateExcerpt('Multiple   spaces\n\nand newlines', 200);
    expect(result).toBe('Multiple spaces and newlines');
  });

  it('should handle empty input', () => {
    const result = generateExcerpt('', 200);
    expect(result).toBe('');
  });

  it('should use default maxLength of 200', () => {
    const longText = 'A'.repeat(300);
    const result = generateExcerpt(longText);
    expect(result.length).toBeLessThanOrEqual(201);
  });
});
