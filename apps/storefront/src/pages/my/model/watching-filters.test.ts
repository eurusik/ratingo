import fc from 'fast-check';
import type { LibraryTitle } from './library-title';
import {
  WATCHING_FILTERS,
  filterCounts,
  firstFilledFilter,
  groupByKind,
  visibleWatchingItems,
  type WatchingItem,
  type WatchingKind,
} from './watching-filters';

const KINDS: readonly WatchingKind[] = ['fresh', 'next', 'waiting', 'paused', 'dropped'];

function title(id: string, name = `Show ${id}`): LibraryTitle {
  return { mediaItemId: id, type: 'show', slug: id, title: name };
}

function item(kind: WatchingKind, id: string, name?: string): WatchingItem {
  if (kind === 'fresh') {
    return {
      kind,
      title: title(id, name),
      showRecordId: `record-${id}`,
      isNewSeason: false,
      episode: { episodeId: `ep-${id}`, seasonNumber: 1, episodeNumber: 2 },
    };
  }
  if (kind === 'next') return { kind, title: title(id, name), watched: 1, total: 4 };
  return { kind, title: title(id, name) };
}

const itemsArbitrary = fc
  .array(fc.constantFrom(...KINDS))
  .map((kinds) => kinds.map((kind, index) => item(kind, String(index))));

describe('watching filters', () => {
  it('counts every item in exactly one filter', () => {
    fc.assert(
      fc.property(itemsArbitrary, (items) => {
        const counts = filterCounts(items);
        const total = WATCHING_FILTERS.reduce((sum, filter) => sum + counts[filter], 0);
        expect(total).toBe(items.length);
      }),
    );
  });

  it('opens the first filter that has titles', () => {
    expect(firstFilledFilter({ episodes: 0, waiting: 3, postponed: 1 })).toBe('waiting');
    expect(firstFilledFilter({ episodes: 0, waiting: 0, postponed: 0 })).toBe('episodes');
  });

  it('groups new and next episodes under one filter and both shelves under another', () => {
    const items = [
      item('fresh', 'a'),
      item('next', 'b'),
      item('paused', 'c'),
      item('dropped', 'd'),
    ];

    expect(visibleWatchingItems(items, { filter: 'episodes', query: '' })).toEqual(
      items.slice(0, 2),
    );
    expect(visibleWatchingItems(items, { filter: 'postponed', query: '' })).toEqual(items.slice(2));
    expect(visibleWatchingItems(items, { filter: 'waiting', query: '' })).toEqual([]);
  });

  it('searches across every filter, ignoring case and diacritics', () => {
    const items = [
      item('fresh', 'a', 'Andor'),
      item('dropped', 'b', 'Ánatomia'),
      item('waiting', 'c'),
    ];

    expect(
      visibleWatchingItems(items, { filter: 'waiting', query: ' an ' }).map(
        (row) => row.title.mediaItemId,
      ),
    ).toEqual(['a', 'b']);
  });

  it('keeps every item when grouping consecutive kinds', () => {
    fc.assert(
      fc.property(itemsArbitrary, (items) => {
        const groups = groupByKind(items);
        expect(groups.flatMap((group) => group.rows)).toEqual(items);
        groups.forEach((group, index) => {
          expect(group.kind).not.toBe(groups[index + 1]?.kind);
        });
      }),
    );
  });
});
