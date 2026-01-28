import {
  RatingSource,
  OfferType,
  DistributionChannel,
  type NormalizedOfferType,
} from '../types/policy.types';
import type { PolicyEngineInput, BreakoutRule, NormalizedOffer } from '../types/policy.types';
import {
  matchesExcludeOriginCountries,
  matchesOriginCountries,
  matchesMinImdbVotes,
  matchesMinTraktVotes,
  matchesMinQualityScore,
  matchesProviders,
  matchesRatingsPresent,
} from './requirement-matchers';

describe('RequirementMatchers', () => {
  const createMediaItem = (
    overrides: Partial<PolicyEngineInput['mediaItem']> = {},
  ): PolicyEngineInput['mediaItem'] => ({
    id: 'test-id',
    originCountries: ['US'],
    originalLanguage: 'en',
    title: 'Test Movie',
    overview: 'Test overview',
    contentClass: 'mainstream',
    normalizedOffers: [],
    voteCountImdb: null,
    voteCountTrakt: null,
    ratingImdb: null,
    ratingMetacritic: null,
    ratingRottenTomatoes: null,
    ratingTrakt: null,
    ...overrides,
  });

  describe('matchesExcludeOriginCountries', () => {
    it('should return true when excludeOriginCountries is undefined', () => {
      expect(matchesExcludeOriginCountries(createMediaItem(), undefined)).toBe(true);
    });

    it('should return true when excludeOriginCountries is empty', () => {
      expect(matchesExcludeOriginCountries(createMediaItem(), [])).toBe(true);
    });

    it('should return false when origin country is in exclude list', () => {
      expect(
        matchesExcludeOriginCountries(createMediaItem({ originCountries: ['RU'] }), ['RU', 'BY']),
      ).toBe(false);
    });

    it('should return true when origin country is not in exclude list', () => {
      expect(
        matchesExcludeOriginCountries(createMediaItem({ originCountries: ['US'] }), ['RU', 'BY']),
      ).toBe(true);
    });

    it('should return false when media has no origin countries (fail safe)', () => {
      expect(matchesExcludeOriginCountries(createMediaItem({ originCountries: [] }), ['RU'])).toBe(
        false,
      );
    });

    it('should return false when any origin country is excluded', () => {
      expect(
        matchesExcludeOriginCountries(createMediaItem({ originCountries: ['US', 'RU'] }), ['RU']),
      ).toBe(false);
    });
  });

  describe('matchesOriginCountries', () => {
    it('should return true when originCountries requirement is undefined', () => {
      expect(matchesOriginCountries(createMediaItem(), undefined)).toBe(true);
    });

    it('should return true when originCountries requirement is empty', () => {
      expect(matchesOriginCountries(createMediaItem(), [])).toBe(true);
    });

    it('should return true when any origin country matches', () => {
      expect(
        matchesOriginCountries(createMediaItem({ originCountries: ['US', 'GB'] }), ['GB', 'FR']),
      ).toBe(true);
    });

    it('should return false when no origin country matches', () => {
      expect(
        matchesOriginCountries(createMediaItem({ originCountries: ['US'] }), ['GB', 'FR']),
      ).toBe(false);
    });

    it('should return false when media has no origin countries', () => {
      expect(matchesOriginCountries(createMediaItem({ originCountries: [] }), ['US'])).toBe(false);
    });
  });

  describe('matchesMinImdbVotes', () => {
    it('should return true when requirement is undefined', () => {
      expect(matchesMinImdbVotes(createMediaItem(), undefined)).toBe(true);
    });

    it('should return true when votes meet minimum', () => {
      expect(matchesMinImdbVotes(createMediaItem({ voteCountImdb: 10000 }), 5000)).toBe(true);
    });

    it('should return true when votes equal minimum', () => {
      expect(matchesMinImdbVotes(createMediaItem({ voteCountImdb: 5000 }), 5000)).toBe(true);
    });

    it('should return false when votes below minimum', () => {
      expect(matchesMinImdbVotes(createMediaItem({ voteCountImdb: 1000 }), 5000)).toBe(false);
    });

    it('should return false when votes is null', () => {
      expect(matchesMinImdbVotes(createMediaItem({ voteCountImdb: null }), 5000)).toBe(false);
    });
  });

  describe('matchesMinTraktVotes', () => {
    it('should return true when requirement is undefined', () => {
      expect(matchesMinTraktVotes(createMediaItem(), undefined)).toBe(true);
    });

    it('should return true when votes meet minimum', () => {
      expect(matchesMinTraktVotes(createMediaItem({ voteCountTrakt: 1000 }), 500)).toBe(true);
    });

    it('should return false when votes below minimum', () => {
      expect(matchesMinTraktVotes(createMediaItem({ voteCountTrakt: 100 }), 500)).toBe(false);
    });

    it('should return false when votes is null', () => {
      expect(matchesMinTraktVotes(createMediaItem({ voteCountTrakt: null }), 500)).toBe(false);
    });
  });

  describe('matchesMinQualityScore', () => {
    const createStats = (qualityScore: number | null): PolicyEngineInput['stats'] => ({
      qualityScore,
      popularityScore: 0.5,
      freshnessScore: 0.5,
      ratingoScore: 50,
    });

    it('should return true when requirement is undefined', () => {
      expect(matchesMinQualityScore(createStats(0.5), undefined)).toBe(true);
    });

    it('should return true when score meets minimum', () => {
      expect(matchesMinQualityScore(createStats(0.7), 0.5)).toBe(true);
    });

    it('should return true when score equals minimum', () => {
      expect(matchesMinQualityScore(createStats(0.5), 0.5)).toBe(true);
    });

    it('should return false when score below minimum', () => {
      expect(matchesMinQualityScore(createStats(0.3), 0.5)).toBe(false);
    });

    it('should return false when score is null', () => {
      expect(matchesMinQualityScore(createStats(null), 0.5)).toBe(false);
    });

    it('should return false when stats is null', () => {
      expect(matchesMinQualityScore(null, 0.5)).toBe(false);
    });
  });

  describe('matchesProviders', () => {
    const createOffer = (
      providerId: string,
      offerType: NormalizedOfferType = OfferType.FLATRATE,
    ): NormalizedOffer => ({
      providerId,
      offerType,
      distributionChannel: DistributionChannel.DIRECT,
      isAdsTier: false,
    });

    it('should return true when requirement is undefined', () => {
      const requirements: BreakoutRule['requirements'] = {};
      expect(matchesProviders(createMediaItem(), requirements)).toBe(true);
    });

    it('should return true when requirement is empty array', () => {
      const requirements: BreakoutRule['requirements'] = { requireAnyOfProviders: [] };
      expect(matchesProviders(createMediaItem(), requirements)).toBe(true);
    });

    it('should return true when any required provider is present', () => {
      const mediaItem = createMediaItem({
        normalizedOffers: [createOffer('netflix'), createOffer('amazon')],
      });
      const requirements: BreakoutRule['requirements'] = {
        requireAnyOfProviders: ['netflix', 'disney'],
      };
      expect(matchesProviders(mediaItem, requirements)).toBe(true);
    });

    it('should return false when no required provider is present', () => {
      const mediaItem = createMediaItem({
        normalizedOffers: [createOffer('hbo')],
      });
      const requirements: BreakoutRule['requirements'] = {
        requireAnyOfProviders: ['netflix', 'disney'],
      };
      expect(matchesProviders(mediaItem, requirements)).toBe(false);
    });
  });

  describe('matchesRatingsPresent', () => {
    it('should return true when requirement is undefined', () => {
      expect(matchesRatingsPresent(createMediaItem(), undefined)).toBe(true);
    });

    it('should return true when requirement is empty array', () => {
      expect(matchesRatingsPresent(createMediaItem(), [])).toBe(true);
    });

    it('should return true when any required rating is present', () => {
      expect(
        matchesRatingsPresent(createMediaItem({ ratingImdb: 7.5 }), [
          RatingSource.IMDB,
          RatingSource.TRAKT,
        ]),
      ).toBe(true);
    });

    it('should return false when no required rating is present', () => {
      expect(
        matchesRatingsPresent(createMediaItem(), [RatingSource.IMDB, RatingSource.TRAKT]),
      ).toBe(false);
    });
  });
});
