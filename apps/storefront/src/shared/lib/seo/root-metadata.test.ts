import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDictionary } from '@/shared/i18n';
import { buildRootMetadata } from './root-metadata';
import { DEFAULT_SHARE_IMAGE } from './share-image';

const publicDir = join(__dirname, '../../../../public');

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

  it('points browser tabs and the iOS home screen at the brand icons', () => {
    expect(metadataFor('uk', false).icons).toMatchObject({
      icon: expect.arrayContaining([expect.objectContaining({ type: 'image/svg+xml' })]),
      apple: [expect.objectContaining({ sizes: '180x180' })],
    });
  });

  it('shares the brand image on every page that keeps the default preview', () => {
    const metadata = metadataFor('uk', false);

    expect(metadata.openGraph?.images).toEqual([DEFAULT_SHARE_IMAGE]);
    expect(metadata.twitter?.images).toEqual([DEFAULT_SHARE_IMAGE]);
    expect(existsSync(join(publicDir, DEFAULT_SHARE_IMAGE.url))).toBe(true);
  });

  it('only links icons that exist in public', () => {
    const { icon, apple } = metadataFor('uk', false).icons as Record<string, { url: string }[]>;

    expect([...icon, ...apple].filter(({ url }) => !existsSync(join(publicDir, url)))).toEqual([]);
  });

  it('uses the short brand name for the home screen title', () => {
    expect(metadataFor('uk', false).appleWebApp).toMatchObject({ title: 'Ratingo' });
  });
});
