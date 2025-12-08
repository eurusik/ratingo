import { NormalizedMedia } from '../../../../domain/models/normalized-media.model';
import { MediaType } from '@/common/enums/media-type.enum';
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
      media.details = {
        runtime: data.runtime,
        budget: data.budget,
        revenue: data.revenue,
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
