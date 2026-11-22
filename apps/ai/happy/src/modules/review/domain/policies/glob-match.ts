const REGEX_SPECIAL = /[.+^$()|[\]\\]/g;

const braceDepth = (pattern: string, index: number): number => {
  const before = pattern.slice(0, index);
  return (before.match(/\{/g)?.length ?? 0) - (before.match(/\}/g)?.length ?? 0);
};

const compiled = new Map<string, RegExp>();

const compile = (pattern: string): RegExp => {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern.charAt(index);
    if (char === '*' && pattern.charAt(index + 1) === '*') {
      const followedBySlash = pattern.charAt(index + 2) === '/';
      source += followedBySlash ? '(?:.*/)?' : '.*';
      index += followedBySlash ? 2 : 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '{') {
      source += '(?:';
    } else if (char === '}') {
      source += ')';
    } else if (char === ',' && braceDepth(pattern, index) > 0) {
      source += '|';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(REGEX_SPECIAL, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
};

export const globMatches = (pattern: string, path: string): boolean => {
  let regex = compiled.get(pattern);
  if (regex === undefined) {
    regex = compile(pattern);
    compiled.set(pattern, regex);
  }
  return regex.test(path);
};

export const matchesAnyGlob = (patterns: readonly string[], path: string): boolean =>
  patterns.some((pattern) => globMatches(pattern, path));
