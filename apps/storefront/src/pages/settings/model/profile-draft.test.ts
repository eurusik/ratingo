import fc from 'fast-check';
import {
  changesOf,
  hasChanges,
  isWebsite,
  normalizeWebsite,
  type ProfileDraft,
} from './profile-draft';

const SAVED: ProfileDraft = {
  username: 'ivan_42',
  region: 'UA',
  bio: 'Серіали від HBO',
  location: 'Львів',
  website: 'mysite.com',
};

describe('normalizeWebsite', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeWebsite(' mysite.com/me ')).toBe('https://mysite.com/me');
  });

  it('keeps an explicit scheme', () => {
    expect(normalizeWebsite('http://old.site')).toBe('http://old.site');
  });

  it('leaves an empty field empty', () => {
    expect(normalizeWebsite('   ')).toBe('');
  });
});

describe('isWebsite', () => {
  it.each(['', 'mysite.com', 'https://instagram.com/me', 'sub.domain.ua/path?q=1'])(
    'accepts %p',
    (value) => expect(isWebsite(value)).toBe(true),
  );

  it.each(['localhost', 'not a site', 'javascript://alert.x', 'ftp://files.site'])(
    'rejects %p',
    (value) => expect(isWebsite(value)).toBe(false),
  );
});

describe('changesOf', () => {
  it('sends only what changed, clearing empty fields with null', () => {
    expect(changesOf(SAVED, { ...SAVED, bio: '  ', website: 'new.site' })).toEqual({
      bio: null,
      website: 'https://new.site',
    });
  });

  it('ignores edits that only add surrounding spaces', () => {
    expect(hasChanges(SAVED, { ...SAVED, username: ' ivan_42 ', location: 'Львів  ' })).toBe(false);
  });

  it('finds no changes between a draft and itself', () => {
    const drafts = fc.record({
      username: fc.string(),
      region: fc.constantFrom('UA', 'US', 'PL'),
      bio: fc.string(),
      location: fc.string(),
      website: fc.string(),
    });
    fc.assert(fc.property(drafts, (draft) => expect(changesOf(draft, { ...draft })).toEqual({})));
  });
});
