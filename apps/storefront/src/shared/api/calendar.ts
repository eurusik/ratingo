import type { GetData, components } from '@ratingo/api-contract';
import { apiGet } from '@ratingo/web-core/api';
import { cacheOptions, type CatalogCache } from './request-cache';

export type CalendarRange = GetData<'/api/catalog/shows/calendar'>;
export type CalendarEpisode = components['schemas']['CalendarEpisodeDto'];

export interface CalendarRangeQuery {
  startDate: string;
  days: number;
  personalized: boolean;
}

export const calendarApi = {
  getRange(
    { startDate, days, personalized }: CalendarRangeQuery,
    cache?: CatalogCache,
  ): Promise<CalendarRange> {
    return apiGet<CalendarRange>('catalog/shows/calendar', {
      searchParams: { startDate, days, personalized: String(personalized) },
      ...cacheOptions(cache),
    });
  },
} as const;
