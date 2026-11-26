import { DEFAULT_API_URL as MDBLIST_DEFAULT_API_URL } from './mdblist.config';
import { OMDB_DEFAULT_API_URL } from './omdb.config';
import { TMDB_DEFAULT_API_URL } from './tmdb.config';
import { TRAKT_DEFAULT_API_URL } from './trakt.config';
import { TVMAZE_DEFAULT_API_URL } from './tvmaze.config';

export interface ExternalProviderEntry {
  apiUrl: string;
  description: string;
}

export const EXTERNAL_PROVIDERS: readonly ExternalProviderEntry[] = [
  {
    apiUrl: TMDB_DEFAULT_API_URL,
    description: 'Main catalog source: titles, images, release dates, cinemas.',
  },
  {
    apiUrl: TRAKT_DEFAULT_API_URL,
    description: 'Trending, anticipated and watcher stats; strict rate limit.',
  },
  { apiUrl: OMDB_DEFAULT_API_URL, description: 'IMDb ratings; daily request limit.' },
  { apiUrl: TVMAZE_DEFAULT_API_URL, description: 'Episode air dates for shows.' },
  {
    apiUrl: MDBLIST_DEFAULT_API_URL,
    description: 'Rotten Tomatoes ratings; small daily quota.',
  },
];
