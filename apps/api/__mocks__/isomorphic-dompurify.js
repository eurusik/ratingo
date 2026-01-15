/**
 * Mock for isomorphic-dompurify to avoid ESM issues in Jest.
 * Provides basic sanitization for testing purposes.
 * 
 * The real isomorphic-dompurify exports DOMPurify as default,
 * which has a .sanitize() method.
 */
const sanitize = (html, options) => {
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
    // Remove disallowed tags but keep content
    const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    result = result.replace(tagPattern, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match;
      }
      return '';
    });
  }
  
  return result;
};

// Export as default (matching isomorphic-dompurify's export)
// DOMPurify.default.sanitize() pattern
module.exports = {
  sanitize,
};

// Also set as default export for ESM-style imports
module.exports.default = {
  sanitize,
};
