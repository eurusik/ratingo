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

/**
 * Pure utility class to transform raw TMDB JSON responses into the internal NormalizedMedia format.
 * Handles type-specific mapping (Movie vs Show) and slug generation.
 */
export class TmdbMapper {
  /**
   * Converts raw TMDB API response to our Domain Model.
   * Returns null if content is missing essential localized data (e.g. overview).
   */
  static toDomain(data: any, type: MediaType): NormalizedMedia | null {
    const isMovie = type === MediaType.MOVIE;
    const title = isMovie ? data.title : data.name;
    const overview = data.overview;

    if (!title || title.trim() === '' || !overview || overview.trim() === '') {
      return null;
    }

    const media: NormalizedMedia = {
      externalIds: {
        tmdbId: data.id,
        imdbId: data.imdb_id || data.external_ids?.imdb_id || null,
      },
      type,
      title: isMovie ? data.title : data.name,
      originalTitle: isMovie ? data.original_title : data.original_name,
      overview: data.overview || null,
      slug: this.generateSlug(isMovie ? data.title : data.name),

      posterPath: data.poster_path || null,
      backdropPath: data.backdrop_path || null,

      rating: data.vote_average || 0,
      voteCount: data.vote_count || 0,
      popularity: data.popularity || 0,

      releaseDate:
        data.release_date || data.first_air_date
          ? new Date(data.release_date || data.first_air_date)
          : null,
      status: data.status || null,
      isAdult: data.adult || false,

      genres: (data.genres || []).map((g: any) => ({
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
      const releaseDates = this.extractReleaseDates(data);
      media.details = {
        runtime: data.runtime,
        budget: data.budget,
        revenue: data.revenue,
        status: data.status || null,
        theatricalReleaseDate: releaseDates.theatricalReleaseDate,
        digitalReleaseDate: releaseDates.digitalReleaseDate,
        releases: releaseDates.releases,
      };
    } else {
      media.details = {
        totalSeasons: data.number_of_seasons,
        totalEpisodes: data.number_of_episodes,
        lastAirDate: data.last_air_date ? new Date(data.last_air_date) : null,
        status: data.status || null,
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
  private static extractReleaseDates(data: any): {
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

    return {
      theatricalReleaseDate,
      digitalReleaseDate,
      releases: allReleases,
    };
  }

  private static extractCredits(data: any, type: MediaType): Credits {
    const credits: Credits = { cast: [], crew: [] };
    const isMovie = type === MediaType.MOVIE;

    if (isMovie) {
      const rawCast = data.credits?.cast || [];
      const rawCrew = data.credits?.crew || [];

      credits.cast = this.processCast(rawCast, true);

      // Movies: Filter Directors
      const processedCrew = new Map<number, CrewMember>();
      rawCrew
        .filter((c: any) => c.job === 'Director')
        .forEach((c: any) => this.addCrewMember(processedCrew, c, 'Director'));
      credits.crew = Array.from(processedCrew.values());
    } else {
      const rawCast = data.aggregate_credits?.cast || [];

      credits.cast = this.processCast(rawCast, false);

      // Shows: Creators (from created_by)
      const processedCrew = new Map<number, CrewMember>();
      if (Array.isArray(data.created_by)) {
        data.created_by.forEach((c: any) => this.addCrewMember(processedCrew, c, 'Creator'));
      }
      credits.crew = Array.from(processedCrew.values());
    }

    return credits;
  }

  private static processCast(rawCast: any[], isMovie: boolean): CastMember[] {
    return rawCast
      .sort((a: any, b: any) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        return orderA - orderB;
      })
      .slice(0, 10)
      .map((c: any, index: number) => ({
        tmdbId: c.id,
        name: c.name,
        character: isMovie ? c.character : c.roles?.[0]?.character || 'Unknown',
        profilePath: c.profile_path,
        order: c.order ?? index,
      }));
  }

  private static addCrewMember(map: Map<number, CrewMember>, c: any, job: string) {
    if (!map.has(c.id)) {
      map.set(c.id, {
        tmdbId: c.id,
        name: c.name,
        job: job,
        department: c.department || (job === 'Creator' ? 'Writing' : 'Directing'),
        profilePath: c.profile_path,
      });
    }
  }

  private static extractVideos(data: any): NormalizedVideo[] {
    const results = data.videos?.results;
    if (!Array.isArray(results) || results.length === 0) {
      return [];
    }

    return results
      .filter(
        (v: any) =>
          v.site === VideoSiteEnum.YOUTUBE &&
          (v.type === VideoTypeEnum.TRAILER || v.type === VideoTypeEnum.TEASER) &&
          (v.iso_639_1 === VideoLanguageEnum.EN || v.iso_639_1 === VideoLanguageEnum.UK)
      )
      .sort((a: any, b: any) => {
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
      .map((v: any) => ({
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

  private static extractProviders(data: any): WatchProvidersMap | null {
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

  private static mapProviderList(list: any[]): WatchProvider[] | undefined {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list.map((p) => ({
      providerId: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path,
      displayPriority: p.display_priority,
    }));
  }
}
