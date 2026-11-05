import * as schema from '../../../../database/schema';

export const POLICY_EVALUATION_SELECT_FIELDS = {
  id: schema.mediaItems.id,
  title: schema.mediaItems.title,
  overview: schema.mediaItems.overview,
  originCountries: schema.mediaItems.originCountries,
  originalLanguage: schema.mediaItems.originalLanguage,
  contentClass: schema.mediaItems.contentClass,
  ratingImdb: schema.mediaItems.ratingImdb,
  ratingMetacritic: schema.mediaItems.ratingMetacritic,
  ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
  ratingTrakt: schema.mediaItems.ratingTrakt,
  voteCountImdb: schema.mediaItems.voteCountImdb,
  voteCountTrakt: schema.mediaItems.voteCountTrakt,
  qualityScore: schema.mediaStats.qualityScore,
  popularityScore: schema.mediaStats.popularityScore,
  freshnessScore: schema.mediaStats.freshnessScore,
  ratingoScore: schema.mediaStats.ratingoScore,
  watchersCount: schema.mediaStats.watchersCount,
};
