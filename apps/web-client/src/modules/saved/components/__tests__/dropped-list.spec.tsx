/**
 * Tests for DroppedList component: loading, empty state, and items rendering.
 */

import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

jest.mock('@/core/api/me-lists.client', () => ({
  meListsApi: {},
  USER_MEDIA_STATE: {
    WATCHING: 'watching',
    COMPLETED: 'completed',
    PLANNED: 'planned',
    DROPPED: 'dropped',
    PAUSED: 'paused',
  },
}));

import { DroppedList } from '../dropped-list';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
      activity: {
        empty: {
          dropped: {
            title: 'Немає покинутого контенту',
            description: "Контент, який ви покинули, з'явиться тут",
          },
        },
        toast: {
          paused: 'Поставлено на паузу',
          resumed: 'Продовжено перегляд',
          dropped: 'Покинуто',
          restored: 'Повернено до списку',
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
      saved: {
        states: {
          watching: 'Дивлюсь',
          completed: 'Переглянуто',
          planned: 'Заплановано',
          paused: 'На паузі',
          dropped: 'Покинуто',
        },
        actions: {
          pause: 'На паузу',
          resume: 'Продовжити',
          drop: 'Покинути',
          restore: 'Повернути',
        },
        dropConfirm: {
          title: 'Покинути перегляд?',
          message: 'Підписки на сповіщення будуть скасовані.',
        },
        sort: {
          recent: 'Нещодавні',
          rating: 'За оцінкою',
          releaseDate: 'За датою виходу',
        },
      },
      mediaType: {
        movie: 'Фільм',
        show: 'Серіал',
      },
      common: {
        cancel: 'Скасувати',
      },
    },
    locale: 'uk',
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill, ...props }: Record<string, unknown>) => <img {...props} />,
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: Record<string, unknown>) => (
    <a {...props}>{children as React.ReactNode}</a>
  ),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/shared/ui', () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} />,
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  AlertDialogCancel: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
  Select: ({ children }: { children: React.ReactNode }) => <div data-testid="sort-select">{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  ToggleGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToggleGroupItem: ({ children }: { children: React.ReactNode; value: string }) => <button>{children}</button>,
}));

const mockUseDropped = jest.fn();
jest.mock('../../hooks/use-me-lists', () => ({
  useDropped: (...args: unknown[]) => mockUseDropped(...args),
  usePauseMedia: () => ({ mutate: jest.fn(), isPending: false }),
  useResumeMedia: () => ({ mutate: jest.fn(), isPending: false }),
  useDropMedia: () => ({ mutate: jest.fn(), isPending: false }),
  useRestoreMedia: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('../../hooks/use-me-list-state', () => ({
  useMeListState: () => ({
    sort: 'recent',
    mediaType: 'all',
    handleSortChange: jest.fn(),
    handleMediaTypeChange: jest.fn(),
  }),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    mediaItemId: 'media-1',
    state: 'dropped',
    rating: null,
    progressSummary: null,
    mediaSummary: {
      title: 'Покинутий серіал',
      slug: 'dropped-show',
      type: 'show',
      releaseDate: '2024-03-10',
      poster: { small: '/poster-dropped.jpg' },
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('DroppedList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders skeleton while loading', () => {
    mockUseDropped.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<DroppedList />);

    // MeListSkeleton renders a grid of skeleton placeholders
    expect(screen.queryByText('Немає покинутого контенту')).not.toBeInTheDocument();
    expect(screen.queryByText('Повернути')).not.toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    mockUseDropped.mockReturnValue({
      data: { pages: [{ data: [], meta: { total: 0 } }], pageParams: [0] },
      isLoading: false,
    });

    render(<DroppedList />);

    expect(screen.getByText('Немає покинутого контенту')).toBeInTheDocument();
    expect(screen.getByText("Контент, який ви покинули, з'явиться тут")).toBeInTheDocument();
  });

  it('renders dropped items when data is present', () => {
    const items = [
      makeItem({ id: 'item-1', mediaItemId: 'media-1' }),
      makeItem({
        id: 'item-2',
        mediaItemId: 'media-2',
        mediaSummary: {
          title: 'Другий серіал',
          slug: 'second-show',
          type: 'show',
          releaseDate: '2024-05-01',
          poster: { small: '/poster-2.jpg' },
        },
      }),
    ];

    mockUseDropped.mockReturnValue({
      data: { pages: [{ data: items, meta: { total: 2 } }], pageParams: [0] },
      isLoading: false,
    });

    render(<DroppedList />);

    expect(screen.getByText('Покинутий серіал')).toBeInTheDocument();
    expect(screen.getByText('Другий серіал')).toBeInTheDocument();
  });

  it('shows restore button for dropped items', () => {
    mockUseDropped.mockReturnValue({
      data: { pages: [{ data: [makeItem()], meta: { total: 1 } }], pageParams: [0] },
      isLoading: false,
    });

    render(<DroppedList />);

    expect(screen.getByText('Повернути')).toBeInTheDocument();
    expect(screen.queryByText('Покинути')).not.toBeInTheDocument();
    expect(screen.queryByText('На паузу')).not.toBeInTheDocument();
  });

  it('passes default sort "recent" to useDropped', () => {
    mockUseDropped.mockReturnValue({
      data: { pages: [{ data: [], meta: { total: 0 } }], pageParams: [0] },
      isLoading: false,
    });

    render(<DroppedList />);

    expect(mockUseDropped).toHaveBeenCalledWith(expect.objectContaining({ sort: 'recent', type: 'all' }));
  });

  it('renders empty state when data is undefined (null response)', () => {
    mockUseDropped.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(<DroppedList />);

    expect(screen.getByText('Немає покинутого контенту')).toBeInTheDocument();
  });
});
