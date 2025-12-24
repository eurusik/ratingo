import {
  NormalizedMedia,
  NormalizedVideo,
  Credits,
  CastMember,
  CrewMember,
  WatchProvidersMap,
  WatchProvider,
} from '../../ingestion/domain/models/normalized-media.model';
import { MediaType } from '../../../common/enums/media-type.enum';
import { VideoSiteEnum, VideoTypeEnum, VideoLanguageEnum } from '../../../common/enums/video.enum';
import { DEFAULT_REGION } from '../../../common/constants';
import slugify from 'slugify';
import {
  normalizeOriginCountries,
  normalizeOriginalLanguage,
} from '../../catalog-policy/domain/utils/country-language.util';
import {
  TmdbMediaResponse,
  TmdbMovieResponse,
  TmdbShowResponse,
  TmdbCastMember,
  TmdbCrewMember,
  TmdbCreator,
  TmdbVideo,
  TmdbWatchProvider,
  TmdbSeason,
  TmdbReleaseDatesCountry,
} from '../types/tmdb-api.types';

/**
 * Pure utility class to transform raw TMDB JSON responses into the internal NormalizedMedia format.
 * Handles type-specific mapping (Movie vs Show) and slug generation.
 */
export class TmdbMapper {
  /**
   * Converts raw TMDB API response to our Domain Model.
   * Returns null if content is missing essential localized data (e.g. overview).
   */
  static toDomain(data: TmdbMediaResponse, type: MediaType): NormalizedMedia | null {
    const isMovie = type === MediaType.MOVIE;
    const title = isMovie ? (data as TmdbMovieResponse).title : (data as TmdbShowResponse).name;
    const overview = data.overview;

    if (!title || title.trim() === '' || !overview || overview.trim() === '') {
      return null;
    }

    const media: NormalizedMedia = {
      externalIds: {
        tmdbId: data.id,
        imdbId:
          data.external_ids?.imdb_id ||
          (isMovie ? (data as TmdbMovieResponse).imdb_id : null) ||
          null,
      },
      type,
      title: isMovie ? (data as TmdbMovieResponse).title : (data as TmdbShowResponse).name,
      originalTitle: isMovie
        ? (data as TmdbMovieResponse).original_title
        : (data as TmdbShowResponse).original_name,
      overview: data.overview || null,
      slug: this.generateSlug(
        isMovie ? (data as TmdbMovieResponse).title : (data as TmdbShowResponse).name,
      ),

      posterPath: data.poster_path || null,
      backdropPath: data.backdrop_path || null,

      rating: data.vote_average || 0,
      voteCount: data.vote_count || 0,
      popularity: data.popularity || 0,

      releaseDate: (
        isMovie
          ? (data as TmdbMovieResponse).release_date
          : (data as TmdbShowResponse).first_air_date
      )
        ? new Date(
            isMovie
              ? (data as TmdbMovieResponse).release_date!
              : (data as TmdbShowResponse).first_air_date!,
          )
        : null,
      status: (data as TmdbMovieResponse | TmdbShowResponse).status || null,
      isAdult: data.adult || false,

      // Origin metadata for catalog policy
      // Movies: production_countries, Shows: origin_country
      originCountries: normalizeOriginCountries(
        isMovie
          ? (data as TmdbMovieResponse).production_countries?.map((c) => c.iso_3166_1)
          : (data as TmdbShowResponse).origin_country,
      ),
      originalLanguage: normalizeOriginalLanguage(data.original_language),

      genres: (data.genres || []).map((g) => ({
        tmdbId: g.id,
        name: g.name,
        slug: this.generateSlug(g.name),
      })),

      videos: this.extractVideos(data),
      credits: this.extractCredits(data, type),
      watchProviders: this.extractProviders(data),

      details: {},
    };

    if (isMovie) {
      const movieData = data as TmdbMovieResponse;
      const releaseDates = this.extractReleaseDates(movieData);
      media.details = {
        runtime: movieData.runtime,
        budget: movieData.budget,
        revenue: movieData.revenue,
        status: movieData.status || null,
        theatricalReleaseDate: releaseDates.theatricalReleaseDate,
        digitalReleaseDate: releaseDates.digitalReleaseDate,
        releases: releaseDates.releases,
      };
    } else {
      const showData = data as TmdbShowResponse;
      media.details = {
        totalSeasons: showData.number_of_seasons,
        totalEpisodes: showData.number_of_episodes,
        lastAirDate: showData.last_air_date ? new Date(showData.last_air_date) : null,
        status: showData.status || null,
        seasons: this.extractSeasons(showData.seasons),
      };
    }

    return media;
  }

  private static generateSlug(text: string): string {
    if (!text) return '';
    return slugify(text, {
      lower: true,
      strict: true,
      locale: 'uk',
    });
  }

  /**
   * Extracts theatrical and digital release dates from TMDB release_dates.
   * Priority: US > UA > first available country.
   * TMDB release types: 1=Premiere, 2=Theatrical (limited), 3=Theatrical, 4=Digital, 5=Physical, 6=TV
   */
  private static extractReleaseDates(data: TmdbMovieResponse): {
    theatricalReleaseDate: Date | null;
    digitalReleaseDate: Date | null;
    releases: Array<{ country: string; type: number; date: string; certification?: string }>;
  } {
    const releaseDates = data.release_dates?.results;
    if (!Array.isArray(releaseDates) || releaseDates.length === 0) {
      return { theatricalReleaseDate: null, digitalReleaseDate: null, releases: [] };
    }

    // Flatten all releases with country info
    const allReleases: Array<{
      country: string;
      type: number;
      date: string;
      certification?: string;
    }> = [];

    for (const countryData of releaseDates) {
      const country = countryData.iso_3166_1;
      for (const release of countryData.release_dates || []) {
        allReleases.push({
          country,
          type: release.type,
          date: release.release_date,
          certification: release.certification || undefined,
        });
      }
    }

    // Priority countries for finding primary release dates
    const priorityCountries = ['US', DEFAULT_REGION];

    // Find theatrical release (type 3) - prioritize US/UA
    let theatricalReleaseDate: Date | null = null;
    for (const country of priorityCountries) {
      const theatrical = allReleases.find((r) => r.country === country && r.type === 3);
      if (theatrical) {
        theatricalReleaseDate = new Date(theatrical.date);
        break;
      }
    }
    // Fallback to any theatrical release
    if (!theatricalReleaseDate) {
      const anyTheatrical = allReleases.find((r) => r.type === 3);
      if (anyTheatrical) {
        theatricalReleaseDate = new Date(anyTheatrical.date);
      }
    }

    // Find digital release (type 4) - prioritize US/UA
    let digitalReleaseDate: Date | null = null;
    for (const country of priorityCountries) {
      const digital = allReleases.find((r) => r.country === country && r.type === 4);
      if (digital) {
        digitalReleaseDate = new Date(digital.date);
        break;
      }
    }
    // Fallback to any digital release
    if (!digitalReleaseDate) {
      const anyDigital = allReleases.find((r) => r.type === 4);
      if (anyDigital) {
        digitalReleaseDate = new Date(anyDigital.date);
      }
    }

    // Filter releases to only UA/US to reduce data size
    const filteredReleases = allReleases.filter((r) => r.country === 'UA' || r.country === 'US');

    return {
      theatricalReleaseDate,
      digitalReleaseDate,
      releases: filteredReleases,
    };
  }

  private static extractCredits(data: TmdbMediaResponse, type: MediaType): Credits {
    const credits: Credits = { cast: [], crew: [] };
    const isMovie = type === MediaType.MOVIE;

    if (isMovie) {
      const movieData = data as TmdbMovieResponse;
      const rawCast = movieData.credits?.cast || [];
      const rawCrew = movieData.credits?.crew || [];

      credits.cast = this.processCast(rawCast, true);

      // Movies: Filter Directors
      const processedCrew = new Map<number, CrewMember>();
      rawCrew
        .filter((c) => c.job === 'Director')
        .forEach((c) => this.addCrewMember(processedCrew, c, 'Director'));
      credits.crew = Array.from(processedCrew.values());
    } else {
      const showData = data as TmdbShowResponse;
      const rawCast = showData.aggregate_credits?.cast || [];

      credits.cast = this.processCast(rawCast, false);

      // Shows: Creators (from created_by)
      const processedCrew = new Map<number, CrewMember>();
      if (Array.isArray(showData.created_by)) {
        showData.created_by.forEach((c) => this.addCrewMember(processedCrew, c, 'Creator'));
      }
      credits.crew = Array.from(processedCrew.values());
    }

    return credits;
  }

  private static processCast(rawCast: TmdbCastMember[], isMovie: boolean): CastMember[] {
    return rawCast
      .sort((a: TmdbCastMember, b: TmdbCastMember) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        return orderA - orderB;
      })
      .slice(0, 10)
      .map((c: TmdbCastMember, index: number) => ({
        tmdbId: c.id,
        name: c.name,
        character: isMovie ? c.character : c.roles?.[0]?.character || 'Unknown',
        profilePath: c.profile_path,
        order: c.order ?? index,
      }));
  }

  private static addCrewMember(
    map: Map<number, CrewMember>,
    c: TmdbCrewMember | TmdbCreator,
    job: string,
  ) {
    if (!map.has(c.id)) {
      map.set(c.id, {
        tmdbId: c.id,
        name: c.name,
        job: job,
        department:
          'department' in c
            ? c.department || (job === 'Creator' ? 'Writing' : 'Directing')
            : job === 'Creator'
              ? 'Writing'
              : 'Directing',
        profilePath: c.profile_path,
      });
    }
  }

  /**
   * Extracts seasons from TMDB API response.
   * Filters out "Specials" (season 0) and maps to NormalizedSeason format.
   */
  private static extractSeasons(seasons: TmdbSeason[] | undefined): Array<{
    tmdbId: number;
    number: number;
    name: string | null;
    overview: string | null;
    posterPath: string | null;
    airDate: Date | null;
    episodeCount: number;
    episodes: [];
  }> {
    if (!Array.isArray(seasons) || seasons.length === 0) {
      return [];
    }

    return seasons
      .filter((s: TmdbSeason) => s.season_number > 0) // Exclude "Specials" (season 0)
      .map((s: TmdbSeason) => ({
        tmdbId: s.id,
        number: s.season_number,
        name: s.name || null,
        overview: s.overview || null,
        posterPath: s.poster_path || null,
        airDate: s.air_date ? new Date(s.air_date) : null,
        episodeCount: s.episode_count || 0,
        episodes: [], // Episodes are fetched separately via Trakt
      }));
  }

  private static extractVideos(data: TmdbMediaResponse): NormalizedVideo[] {
    const results = data.videos?.results;
    if (!Array.isArray(results) || results.length === 0) {
      return [];
    }

    return results
      .filter(
        (v: TmdbVideo) =>
          v.site === VideoSiteEnum.YOUTUBE &&
          (v.type === VideoTypeEnum.TRAILER || v.type === VideoTypeEnum.TEASER) &&
          (v.iso_639_1 === VideoLanguageEnum.EN || v.iso_639_1 === VideoLanguageEnum.UK),
      )
      .sort((a: TmdbVideo, b: TmdbVideo) => {
        // Language Priority: UK > Others
        const isUkA = a.iso_639_1 === VideoLanguageEnum.UK;
        const isUkB = b.iso_639_1 === VideoLanguageEnum.UK;
        if (isUkA !== isUkB) {
          return isUkA ? -1 : 1;
        }

        // Type Priority: Trailer > Teaser
        if (a.type !== b.type) {
          return a.type === VideoTypeEnum.TRAILER ? -1 : 1;
        }

        // Official Priority: Official > Non-Official
        if (a.official !== b.official) {
          return a.official ? -1 : 1;
        }

        // Date Priority: Newest > Oldest
        const dateA = new Date(a.published_at).getTime();
        const dateB = new Date(b.published_at).getTime();
        return dateB - dateA;
      })
      .slice(0, 3) // Take top 3
      .map((v: TmdbVideo) => ({
        key: v.key,
        name: v.name,
        site: v.site as VideoSiteEnum,
        type: v.type as VideoTypeEnum,
        official: v.official,
        language: v.iso_639_1 as VideoLanguageEnum,
        country: v.iso_3166_1 || 'US',
      }));
  }

  /** Allowed regions for watch providers - UA primary, US fallback */
  private static readonly ALLOWED_REGIONS = [DEFAULT_REGION, 'US'];

  private static extractProviders(data: TmdbMediaResponse): WatchProvidersMap | null {
    const results = data['watch/providers']?.results;
    if (!results || typeof results !== 'object') return null;

    const map: WatchProvidersMap = {};

    for (const region of this.ALLOWED_REGIONS) {
      const entry = results[region];
      if (!entry) continue;

      map[region] = {
        link: entry.link ?? null,
        flatrate: this.mapProviderList(entry.flatrate),
        rent: this.mapProviderList(entry.rent),
        buy: this.mapProviderList(entry.buy),
        ads: this.mapProviderList(entry.ads),
        free: this.mapProviderList(entry.free),
      };
    }

    return Object.keys(map).length > 0 ? map : null;
  }

  private static mapProviderList(
    list: TmdbWatchProvider[] | undefined,
  ): WatchProvider[] | undefined {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list.map((p: TmdbWatchProvider) => ({
      providerId: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path,
      displayPriority: p.display_priority,
    }));
  }
}
