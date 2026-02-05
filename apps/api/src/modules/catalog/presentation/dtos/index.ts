// Query DTOs
export { CatalogListQueryDto } from './catalog-list-query.dto';
export { CatalogListQueryWithDaysDto } from './catalog-list-query-with-days.dto';

// Response DTOs - Media details
export { MediaBaseDto } from './media-base.dto';
export { MovieResponseDto } from './movie-response.dto';
export { MovieListItemDto } from './movie-list-item.dto';
export { PaginatedMovieResponseDto } from './paginated-movie-response.dto';
export { ShowResponseDto, EpisodeDto, SeasonDto } from './show-response.dto';

// Response DTOs - Trending
export {
  TrendingShowsQueryDto,
  TrendingItemBaseDto,
  ShowTrendingItemDto,
  MovieTrendingItemDto,
  ShowProgressDto,
  TrendingShowsResponseDto,
} from './trending.dto';

// Response DTOs - Other
export { SearchItemDto, SearchResponseDto } from './search.dto';
export { CalendarEpisodeDto, CalendarDayDto, CalendarResponseDto } from './calendar-response.dto';
export { NewEpisodeDto, NewEpisodesResponseDto } from './new-episodes-response.dto';
export { ProvidersListDto, ProviderDto } from './providers.dto';
export { ImportResultDto } from './import-result.dto';
export { MovieVerdictDto, ShowVerdictDto, ShowStatusHintDto } from './verdict.dto';

// Shared building blocks
export { GenreDto } from './genre.dto';
export { VideoDto } from './video.dto';
export { CastMemberDto, CrewMemberDto, CreditsDto } from './credits.dto';
export { UserMediaStateDto } from './user-media-state.dto';
export { WatchProviderDto, AvailabilityDto } from './availability.dto';
