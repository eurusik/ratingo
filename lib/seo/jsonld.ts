export function generateShowJsonLd(show: any) {
  const title = show.titleUk || show.title;
  const description = show.overviewUk || show.overview;
  const rating = show.primaryRating || show.ratingTmdb || show.ratingTraktAvg || show.ratingImdb;
  const ratingCount = show.ratingTmdbCount || show.ratingTraktVotes || show.imdbVotes;

  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: title,
    description,
    image: show.posterUrl || undefined,
    datePublished: show.firstAirDate || undefined,
    aggregateRating: rating ? {
      '@type': 'AggregateRating',
      ratingValue: rating,
      ratingCount: ratingCount || undefined,
      bestRating: 10,
      worstRating: 0,
    } : undefined,
    numberOfSeasons: show.numberOfSeasons || undefined,
    numberOfEpisodes: show.numberOfEpisodes || undefined,
    genre: Array.isArray(show.genres) ? show.genres.map((g: any) => g.name) : undefined,
  };
}

export function generateBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ratingo',
    description: 'Трендові серіали України з рейтингами TMDB, Trakt та IMDb',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
