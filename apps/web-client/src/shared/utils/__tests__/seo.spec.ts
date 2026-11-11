import { buildWebSiteJsonLd, createMediaMetadata, type SeoMediaItem } from '../seo';
import { formatYear } from '../format';

const outlander: SeoMediaItem = {
  title: 'Чужоземка',
  originalTitle: 'Outlander',
  releaseDate: '2014-08-09T12:00:00.000Z',
  overview:
    'Клер, яка працювала медсестрою під час Другої світової війни, випадково переміщається в часі і потрапляє в 1743 рік. У цьому світі, повному пригод, вона знайомиться з Джеймі.',
  credits: {
    cast: [{ name: 'Катріона Балф' }, { name: 'Сем Хьюен' }, { name: 'Софі Скелтон' }],
  },
  externalRatings: { imdb: { rating: 8.3 } },
};

const titleOf = (media: SeoMediaItem, type: 'show' | 'movie') =>
  createMediaMetadata(media, { type }).title;

describe('createMediaMetadata', () => {
  describe('title', () => {
    it('reads as one phrase with the year and media kind', () => {
      expect(titleOf(outlander, 'show')).toBe('Чужоземка (2014): актори та рейтинг серіалу');
      expect(
        titleOf({ title: 'Аферист із Tinder', releaseDate: '2022-02-02T12:00:00.000Z' }, 'movie'),
      ).toBe('Аферист із Tinder (2022): актори та рейтинг фільму');
    });

    it('uses a single separator before the site suffix', () => {
      const title = titleOf(outlander, 'show') as string;

      expect(title).not.toMatch(/[—|]/);
    });

    it('drops the year before dropping the rating keywords', () => {
      expect(
        titleOf(
          { title: 'Заради всього людства', releaseDate: '2019-11-01T12:00:00.000Z' },
          'show',
        ),
      ).toBe('Заради всього людства: актори та рейтинг серіалу');
    });

    it('keeps only the cast keyword when the rating does not fit', () => {
      expect(
        titleOf(
          { title: 'Каратель: Останнє вбивство', releaseDate: '2026-05-12T12:00:00.000Z' },
          'movie',
        ),
      ).toBe('Каратель: Останнє вбивство: актори');
    });

    it('falls back to the bare title for very long names', () => {
      expect(
        titleOf(
          {
            title: 'Таємні світи магічного дерева та його мешканців',
            releaseDate: '2024-06-01T12:00:00.000Z',
          },
          'movie',
        ),
      ).toBe('Таємні світи магічного дерева та його мешканців (2024)');
    });

    it('omits an invalid release year', () => {
      expect(titleOf({ title: 'Тед', releaseDate: 'not-a-date' }, 'movie')).toBe(
        'Тед: актори та рейтинг фільму',
      );
    });
  });

  describe('description', () => {
    it('leads with compact facts and leaves room for the overview', () => {
      const description = createMediaMetadata(outlander, { type: 'show' }).description as string;

      expect(description).toMatch(
        /^Outlander, 2014 · IMDb 8\.3 · У ролях: Катріона Балф, Сем Хьюен\. Клер, яка працювала медсестрою під час Другої світової війни/,
      );
      expect(description).not.toContain('Софі Скелтон');
    });

    it('stays within 160 characters and ends with an ellipsis when truncated', () => {
      const description = createMediaMetadata(outlander, { type: 'show' }).description as string;

      expect(Array.from(description).length).toBeLessThanOrEqual(160);
      expect(description.endsWith('…')).toBe(true);
    });

    it('does not split surrogate pairs when truncating', () => {
      const description = createMediaMetadata(
        { title: 'Емодзі', overview: '🎬'.repeat(200) },
        { type: 'movie' },
      ).description as string;

      expect(description).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(Array.from(description).length).toBeLessThanOrEqual(160);
    });

    it('skips an original title equal to the localized one', () => {
      expect(
        createMediaMetadata(
          {
            title: 'Tenet',
            originalTitle: 'Tenet',
            releaseDate: '2020-08-22T12:00:00.000Z',
            credits: null,
            externalRatings: null,
          },
          { type: 'movie' },
        ).description,
      ).toBe('Фільм «Tenet» · 2020. Дивіться на Ratingo');
    });

    it('falls back to the media kind and title when no facts are known', () => {
      expect(createMediaMetadata({ title: 'Тед' }, { type: 'show' }).description).toBe(
        'Серіал «Тед». Дивіться на Ratingo',
      );
    });
  });

  it('keeps share titles short and canonical URL intact', () => {
    const metadata = createMediaMetadata(outlander, { type: 'show', slug: 'chuzhozemka' });

    expect(metadata.openGraph?.title).toBe('Чужоземка (2014) | Ratingo');
    expect(metadata.twitter?.title).toBe('Чужоземка (2014)');
    expect(metadata.alternates?.canonical).toMatch(/\/shows\/chuzhozemka$/);
  });

  it('returns fallback metadata when media is missing', () => {
    expect(createMediaMetadata(null, { type: 'movie' }).title).toBe('Не знайдено');
  });
});

describe('buildWebSiteJsonLd', () => {
  it('declares the site name for search results', () => {
    expect(buildWebSiteJsonLd('https://ratingo.top')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Ratingo',
      url: 'https://ratingo.top',
      inLanguage: 'uk',
    });
  });
});

describe('formatYear', () => {
  it('returns an empty string for invalid dates instead of "NaN"', () => {
    expect(formatYear('not-a-date')).toBe('');
    expect(formatYear('2024-02-27')).toBe('2024');
  });
});
