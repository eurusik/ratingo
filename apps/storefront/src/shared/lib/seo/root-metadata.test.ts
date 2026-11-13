import { getDictionary } from '@/shared/i18n';
import { buildRootMetadata } from './root-metadata';

function metadataFor(locale: 'uk' | 'en', indexingEnabled: boolean) {
  return buildRootMetadata({
    locale,
    dict: getDictionary(locale),
    siteUrl: 'https://ratingo.top',
    indexingEnabled,
  });
}

describe('buildRootMetadata', () => {
  it('hides every page from search engines off the production site', () => {
    expect(metadataFor('uk', false).robots).toEqual({ index: false, follow: false });
  });

  it('lets the production site be indexed with large image previews', () => {
    expect(metadataFor('uk', true).robots).toMatchObject({
      index: true,
      follow: true,
      googleBot: { 'max-image-preview': 'large' },
    });
  });

  it('resolves relative URLs against the site URL', () => {
    expect(String(metadataFor('uk', false).metadataBase)).toBe('https://ratingo.top/');
  });

  it('keeps keywords and the share locale in the page language', () => {
    const english = metadataFor('en', false);

    expect(english.keywords).toContain('ukraine');
    expect(english.keywords).not.toContain('україна');
    expect(english.openGraph).toMatchObject({ locale: 'en_US' });
  });

  it('uses the short brand name for the home screen title', () => {
    expect(metadataFor('uk', false).appleWebApp).toMatchObject({ title: 'Ratingo' });
  });
});
