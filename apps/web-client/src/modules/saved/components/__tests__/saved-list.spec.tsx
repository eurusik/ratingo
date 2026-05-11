/**
 * Tests for SavedList — focused on the "showing X of Y" indicator that
 * disambiguates the tab-badge total (all media types) from the visible
 * count when a media-type filter is active. See issue #98.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));
jest.mock('@/core/api/me-lists.client', () => ({
  meListsApi: {},
  USER_MEDIA_STATE: { WATCHING: 'watching', COMPLETED: 'completed', PLANNED: 'planned', DROPPED: 'dropped', PAUSED: 'paused' },
}));
jest.mock('@/shared/components/infinite-scroll-loader', () => ({
  InfiniteScrollLoader: ({ hasMore, onLoadMore }: { hasMore: boolean; onLoadMore: () => void }) =>
    hasMore ? <button data-testid="load-more" onClick={onLoadMore}>Load more</button> : null,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
      saved: {
        empty: {
          forLater: { title: 'Поки порожньо', description: 'Опис forLater' },
          considering: { title: 'Поки порожньо', description: 'Опис considering' },
          noMovies: 'Немає фільмів',
          noShows: 'Немає серіалів',
        },
        emptyState: { importHint: 'hint', importButton: 'Імпорт' },
        actions: {
          moveToConsidering: 'Перемістити в Роздумую',
          moveToForLater: 'Перемістити в На потім',
        },
        filter: {
          showingCount: '{hidden} {hiddenItem} приховано',
          showAll: 'Показати всі',
          items: {
            movie: { one: 'фільм', few: 'фільми', many: 'фільмів' },
            show: { one: 'серіал', few: 'серіали', many: 'серіалів' },
          },
        },
      },
    },
    locale: 'uk',
  }),
}));

jest.mock('@/shared/ui', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

jest.mock('../saved-item-card', () => ({
  SavedItemCard: ({ title }: { title: string }) => <div data-testid="saved-card">{title}</div>,
}));

jest.mock('../empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

jest.mock('../media-type-filter', () => ({
  MediaTypeFilter: ({
    value,
    onChange,
  }: {
    value: 'all' | 'movie' | 'show';
    onChange: (v: 'all' | 'movie' | 'show') => void;
  }) => (
    <div data-testid="media-type-filter">
      <span data-testid="current-filter">{value}</span>
      <button onClick={() => onChange('all')}>set-all</button>
      <button onClick={() => onChange('movie')}>set-movie</button>
      <button onClick={() => onChange('show')}>set-show</button>
    </div>
  ),
}));

const mockUseSavedForLater = jest.fn();
const mockUseSavedConsidering = jest.fn();

jest.mock('../../hooks', () => ({
  useSavedForLater: (args: unknown) => mockUseSavedForLater(args),
  useSavedConsidering: (args: unknown) => mockUseSavedConsidering(args),
  useUnsaveItem: () => ({ mutate: jest.fn(), isPending: false }),
  useSaveItem: () => ({ mutate: jest.fn(), isPending: false }),
}));

import { SavedList } from '../saved-list';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    mediaItemId: 'media-1',
    list: 'for_later',
    reasonKey: null,
    activeSubscriptionTriggers: [],
    mediaSummary: {
      id: 'media-1',
      type: 'movie',
      title: 'Тестовий фільм',
      slug: 'test-movie',
      releaseDate: '2024-01-01',
      poster: { small: '/poster.jpg' },
    },
    ...overrides,
  };
}

function setForLaterQuery(opts: { items?: unknown[]; total?: number; hasMore?: boolean; isLoading?: boolean; fetchNextPage?: jest.Mock }) {
  mockUseSavedForLater.mockReturnValue({
    data: opts.items === undefined
      ? undefined
      : {
          pages: [
            {
              data: opts.items,
              meta: { total: opts.total ?? opts.items.length, hasMore: opts.hasMore ?? false, limit: 20, offset: 0 },
            },
          ],
          pageParams: [0],
        },
    isLoading: opts.isLoading ?? false,
    isFetchingNextPage: false,
    hasNextPage: opts.hasMore ?? false,
    fetchNextPage: opts.fetchNextPage ?? jest.fn(),
  });
  mockUseSavedConsidering.mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('SavedList — "showing X of Y" indicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render the indicator when filter is "all"', () => {
    setForLaterQuery({ items: [makeItem()], total: 1 });

    render(<SavedList list="for_later" totalAcrossTypes={150} />);

    expect(screen.queryByText(/приховано/)).not.toBeInTheDocument();
  });

  it('renders active-filter banner when filter is "movie" and totals diverge', () => {
    setForLaterQuery({ items: [makeItem()], total: 80 });

    render(<SavedList list="for_later" totalAcrossTypes={150} />);

    fireEvent.click(screen.getByText('set-movie'));

    expect(
      screen.getByText('70 серіалів приховано'),
    ).toBeInTheDocument();
  });

  it('does not render the indicator when filter is active but totals are equal', () => {
    // e.g. user only has movies — filtered total === unfiltered total
    setForLaterQuery({ items: [makeItem()], total: 150 });

    render(<SavedList list="for_later" totalAcrossTypes={150} />);

    fireEvent.click(screen.getByText('set-movie'));

    expect(screen.queryByText(/приховано/)).not.toBeInTheDocument();
  });

  it('hides the indicator again when user resets the filter to "all"', () => {
    setForLaterQuery({ items: [makeItem()], total: 80 });

    render(<SavedList list="for_later" totalAcrossTypes={150} />);

    fireEvent.click(screen.getByText('set-show'));
    expect(screen.getByText('70 фільмів приховано')).toBeInTheDocument();

    fireEvent.click(screen.getByText('set-all'));
    expect(screen.queryByText(/приховано/)).not.toBeInTheDocument();
  });

  it('clicking "Показати всі" resets the filter to "all"', () => {
    setForLaterQuery({ items: [makeItem()], total: 80 });

    render(<SavedList list="for_later" totalAcrossTypes={150} />);

    fireEvent.click(screen.getByText('set-movie'));
    expect(screen.getByText('70 серіалів приховано')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Показати всі' }));
    expect(screen.queryByText(/приховано/)).not.toBeInTheDocument();
    expect(screen.getByTestId('current-filter')).toHaveTextContent('all');
  });

  it('falls back to 0 when totalAcrossTypes prop is omitted (indicator stays hidden)', () => {
    setForLaterQuery({ items: [makeItem()], total: 1 });

    render(<SavedList list="for_later" />);

    fireEvent.click(screen.getByText('set-movie'));

    // 0 is not greater than filteredTotal=1 → no indicator
    expect(screen.queryByText(/приховано/)).not.toBeInTheDocument();
  });

  it('renders InfiniteScrollLoader when hasNextPage is true', () => {
    setForLaterQuery({ items: [makeItem()], total: 100, hasMore: true });

    render(<SavedList list="for_later" totalAcrossTypes={100} />);

    expect(screen.getByTestId('load-more')).toBeInTheDocument();
  });

  it('clicking load-more invokes fetchNextPage', () => {
    const fetchNextPage = jest.fn();
    setForLaterQuery({ items: [makeItem()], total: 100, hasMore: true, fetchNextPage });

    render(<SavedList list="for_later" totalAcrossTypes={100} />);

    fireEvent.click(screen.getByTestId('load-more'));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not render loader when hasNextPage is false', () => {
    setForLaterQuery({ items: [makeItem()], total: 1, hasMore: false });

    render(<SavedList list="for_later" totalAcrossTypes={1} />);

    expect(screen.queryByTestId('load-more')).not.toBeInTheDocument();
  });

  it('uses considering query when list="considering"', () => {
    mockUseSavedForLater.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
    });
    mockUseSavedConsidering.mockReturnValue({
      data: { pages: [{ data: [makeItem()], meta: { total: 30 } }], pageParams: [0] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
    });

    render(<SavedList list="considering" totalAcrossTypes={50} />);

    fireEvent.click(screen.getByText('set-movie'));

    expect(
      screen.getByText('20 серіалів приховано'),
    ).toBeInTheDocument();
  });
});
