import { NormalizedMedia } from '../../../../domain/models/normalized-media.model';
import { MediaType } from '../../../../../../common/enums/media-type.enum';
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
      
      releaseDate: data.release_date || data.first_air_date ? new Date(data.release_date || data.first_air_date) : null,
      status: data.status || null,
      isAdult: data.adult || false,
      
      genres: (data.genres || []).map((g: any) => ({
        tmdbId: g.id,
        name: g.name,
        slug: this.generateSlug(g.name),
      })),
      
      watchProviders: this.extractProviders(data),
      
      details: {},
    };

    if (isMovie) {
      const releaseDates = this.extractReleaseDates(data);
      media.details = {
        runtime: data.runtime,
        budget: data.budget,
        revenue: data.revenue,
        theatricalReleaseDate: releaseDates.theatricalReleaseDate,
        digitalReleaseDate: releaseDates.digitalReleaseDate,
        releases: releaseDates.releases,
      };
    } else {
      media.details = {
        totalSeasons: data.number_of_seasons,
        totalEpisodes: data.number_of_episodes,
        lastAirDate: data.last_air_date ? new Date(data.last_air_date) : null,
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
    const allReleases: Array<{ country: string; type: number; date: string; certification?: string }> = [];
    
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
    const priorityCountries = ['US', 'UA'];
    
    // Find theatrical release (type 3) - prioritize US/UA
    let theatricalReleaseDate: Date | null = null;
    for (const country of priorityCountries) {
      const theatrical = allReleases.find(r => r.country === country && r.type === 3);
      if (theatrical) {
        theatricalReleaseDate = new Date(theatrical.date);
        break;
      }
    }
    // Fallback to any theatrical release
    if (!theatricalReleaseDate) {
      const anyTheatrical = allReleases.find(r => r.type === 3);
      if (anyTheatrical) {
        theatricalReleaseDate = new Date(anyTheatrical.date);
      }
    }

    // Find digital release (type 4) - prioritize US/UA
    let digitalReleaseDate: Date | null = null;
    for (const country of priorityCountries) {
      const digital = allReleases.find(r => r.country === country && r.type === 4);
      if (digital) {
        digitalReleaseDate = new Date(digital.date);
        break;
      }
    }
    // Fallback to any digital release
    if (!digitalReleaseDate) {
      const anyDigital = allReleases.find(r => r.type === 4);
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

  private static extractProviders(data: any): any[] {
    const providers = data['watch/providers']?.results?.UA;
    if (!providers) return [];

    const result: any[] = [];
    const map = (list: any[], type: string) => {
      if (!list) return;
      list.forEach(p => result.push({
        providerId: p.provider_id,
        name: p.provider_name,
        logoPath: p.logo_path,
        displayPriority: p.display_priority,
        type,
      }));
    };

    map(providers.flatrate, 'flatrate');
    map(providers.buy, 'buy');
    map(providers.rent, 'rent');
    map(providers.ads, 'ads');
    map(providers.free, 'free');

    return result;
  }
}
