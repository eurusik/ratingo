import type { GetData, GetQuery, components } from '@ratingo/api-contract';
import { apiGet } from '@ratingo/web-core/api';
import { cacheOptions, type CatalogCache } from './request-cache';

export type CalendarRange = GetData<'/api/catalog/calendar'>;
export type CalendarEpisode = components['schemas']['CalendarEpisodeDto'];
export type CalendarMovie = components['schemas']['CalendarMovieDto'];
export type CalendarMediaType = NonNullable<NonNullable<GetQuery<'/api/catalog/calendar'>>['type']>;

export interface CalendarRangeQuery {
  startDate: string;
  days: number;
  personalized: boolean;
  premieres?: boolean;
  type: CalendarMediaType;
}

function premieresParam(premieres: boolean | undefined) {
  return premieres ? { premieres: 'true' } : {};
}

export const calendarApi = {
  getRange(
    { startDate, days, personalized, premieres, type }: CalendarRangeQuery,
    cache?: CatalogCache,
  ): Promise<CalendarRange> {
    return apiGet<CalendarRange>('catalog/calendar', {
      searchParams: {
        startDate,
        days,
        personalized: String(personalized),
        type,
        ...premieresParam(premieres),
      },
      ...cacheOptions(cache),
    });
  },
} as const;
