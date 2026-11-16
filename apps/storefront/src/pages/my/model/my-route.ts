import { DEFAULT_LIBRARY_LIST, isMainLibraryList, type MainLibraryList } from '@/entities/library';
import type { WatchingFilter } from './watching-filters';

export interface MyRoute {
  list: MainLibraryList;
  watchingFilter?: WatchingFilter;
}

const POSTPONED_LISTS: readonly string[] = ['paused', 'dropped'];

export function resolveMyRoute(listParam: string | undefined): MyRoute {
  if (listParam !== undefined && POSTPONED_LISTS.includes(listParam)) {
    return { list: 'watching', watchingFilter: 'postponed' };
  }
  return { list: isMainLibraryList(listParam) ? listParam : DEFAULT_LIBRARY_LIST };
}
