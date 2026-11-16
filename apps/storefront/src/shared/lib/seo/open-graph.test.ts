import { buildOpenGraph } from './open-graph';
import { DEFAULT_SHARE_IMAGE } from './share-image';

describe('buildOpenGraph', () => {
  it('keeps the site name, type, locale and brand image on every page', () => {
    expect(buildOpenGraph({ locale: 'en' })).toEqual({
      type: 'website',
      siteName: 'Ratingo',
      locale: 'en_US',
      images: [DEFAULT_SHARE_IMAGE],
    });
  });

  it('adds the page title, description and canonical URL when given', () => {
    expect(
      buildOpenGraph({ locale: 'uk', title: 'Календар', description: 'Розклад', url: '/calendar' }),
    ).toMatchObject({
      locale: 'uk_UA',
      title: 'Календар',
      description: 'Розклад',
      url: '/calendar',
    });
  });
});
