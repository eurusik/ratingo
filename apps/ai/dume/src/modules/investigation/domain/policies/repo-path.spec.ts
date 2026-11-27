import fc from 'fast-check';

import {
  PathRejection,
  extensionOf,
  isUnderDirectory,
  normalizeDirectoryPath,
  normalizeFilePath,
} from './repo-path';

const segment = fc.stringMatching(/^[A-Za-z0-9_.-]{1,12}$/);

describe('normalizeFilePath', () => {
  it('never yields a path with a parent segment, a leading slash, a backslash or a control character', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), (raw) => {
        const result = normalizeFilePath(raw);
        if (!result.ok) return;
        expect(result.path.startsWith('/')).toBe(false);
        expect(result.path).not.toContain('\\');
        expect(result.path.split('/')).not.toContain('..');
        expect(result.path.split('/')).not.toContain('.git');
        expect(result.path.split('/')).not.toContain('.');
        expect(result.path.split('/')).not.toContain('');
        expect([...result.path].every((char) => char.charCodeAt(0) > 31 && char !== '\u007f')).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.array(segment, { minLength: 1, maxLength: 6 }), (segments) => {
        const first = normalizeFilePath(segments.join('/'));
        if (!first.ok) return;
        expect(normalizeFilePath(first.path)).toEqual(first);
      }),
    );
  });

  it('rejects any path that contains a parent segment, wherever it sits', () => {
    fc.assert(
      fc.property(
        fc.array(segment.filter((name) => name !== '..' && name !== '.git'), { maxLength: 4 }),
        fc.array(segment.filter((name) => name !== '..' && name !== '.git'), { maxLength: 4 }),
        (before, after) => {
          const result = normalizeFilePath([...before, '..', ...after].join('/'));
          expect(result).toEqual({ ok: false, reason: PathRejection.PARENT_SEGMENT });
        },
      ),
    );
  });

  it('rejects absolute paths, backslashes, control characters and git metadata', () => {
    expect(normalizeFilePath('/etc/passwd')).toEqual({ ok: false, reason: PathRejection.ABSOLUTE });
    expect(normalizeFilePath('a\\b')).toEqual({ ok: false, reason: PathRejection.FORBIDDEN_CHARACTER });
    expect(normalizeFilePath('a\u0000b')).toEqual({ ok: false, reason: PathRejection.FORBIDDEN_CHARACTER });
    expect(normalizeFilePath('apps/.git/config')).toEqual({ ok: false, reason: PathRejection.GIT_METADATA });
    expect(normalizeFilePath('')).toEqual({ ok: false, reason: PathRejection.EMPTY });
    expect(normalizeFilePath('./')).toEqual({ ok: false, reason: PathRejection.EMPTY });
  });

  it('rejects over-long and over-deep paths', () => {
    expect(normalizeFilePath('a'.repeat(400))).toEqual({ ok: false, reason: PathRejection.TOO_LONG });
    expect(normalizeFilePath(Array.from({ length: 40 }, () => 'a').join('/'))).toEqual({
      ok: false,
      reason: PathRejection.TOO_DEEP,
    });
  });

  it('drops leading ./ and repeated slashes', () => {
    expect(normalizeFilePath('./apps//api/src/main.ts')).toEqual({ ok: true, path: 'apps/api/src/main.ts' });
  });
});

describe('normalizeDirectoryPath', () => {
  it('accepts the root in every spelling', () => {
    for (const raw of ['', '.', './', ' ']) {
      expect(normalizeDirectoryPath(raw)).toEqual({ ok: true, path: '' });
    }
  });
});

describe('isUnderDirectory', () => {
  it('matches whole segments only', () => {
    expect(isUnderDirectory('apps/api/x.ts', 'apps/api')).toBe(true);
    expect(isUnderDirectory('apps/api-contract/x.ts', 'apps/api')).toBe(false);
    expect(isUnderDirectory('anything', '')).toBe(true);
  });
});

describe('extensionOf', () => {
  it('lowercases the extension and ignores dotfiles', () => {
    expect(extensionOf('a/b/File.TS')).toBe('ts');
    expect(extensionOf('a/.env')).toBe('');
    expect(extensionOf('a/Makefile')).toBe('');
  });
});
