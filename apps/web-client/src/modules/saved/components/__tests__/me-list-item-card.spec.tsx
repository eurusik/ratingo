/**
 * Tests for MeListItemCard component rendering, state-dependent actions,
 * drop confirmation dialog, and mutation calls.
 */

import { render, screen, fireEvent } from '@testing-library/react';

// ky is ESM-only — must mock before any module that transitively imports it.
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

import { MeListItemCard } from '../me-list-item-card';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
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
      },
      activity: {
        toast: {
          paused: 'Поставлено на паузу',
          resumed: 'Продовжено перегляд',
          dropped: 'Покинуто',
          restored: 'Повернено до списку',
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

const mockPauseMutate = jest.fn();
const mockResumeMutate = jest.fn();
const mockDropMutate = jest.fn();
const mockRestoreMutate = jest.fn();

jest.mock('../../hooks/use-me-lists', () => ({
  usePauseMedia: () => ({ mutate: mockPauseMutate, isPending: false }),
  useResumeMedia: () => ({ mutate: mockResumeMutate, isPending: false }),
  useDropMedia: () => ({ mutate: mockDropMutate, isPending: false }),
  useRestoreMedia: () => ({ mutate: mockRestoreMutate, isPending: false }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/shared/ui', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    mediaItemId: 'media-1',
    state: 'watching',
    rating: null,
    progressSummary: null,
    mediaSummary: {
      title: 'Тест серіал',
      slug: 'test-show',
      type: 'show',
      releaseDate: '2024-01-15',
      poster: { small: '/poster.jpg' },
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('MeListItemCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ---- Rendering ---- */

  describe('Rendering', () => {
    it('renders media title', () => {
      render(<MeListItemCard item={makeItem() as never} />);

      expect(screen.getByText('Тест серіал')).toBeInTheDocument();
    });

    it('renders poster image', () => {
      render(<MeListItemCard item={makeItem() as never} />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/poster.jpg');
    });

    it('renders state label', () => {
      render(<MeListItemCard item={makeItem({ state: 'watching' }) as never} />);

      expect(screen.getByText('Дивлюсь')).toBeInTheDocument();
    });

    it('renders without poster gracefully', () => {
      const item = makeItem({
        mediaSummary: {
          title: 'Без постера',
          slug: 'no-poster',
          type: 'show',
          releaseDate: '2024-01-01',
          poster: null,
        },
      });

      render(<MeListItemCard item={item as never} />);

      expect(screen.getByText('Без постера')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  /* ---- State-dependent actions ---- */

  describe('State-dependent actions', () => {
    it('shows pause and drop buttons for watching state', () => {
      render(<MeListItemCard item={makeItem({ state: 'watching' }) as never} />);

      expect(screen.getByText('На паузу')).toBeInTheDocument();
      expect(screen.getByText('Покинути')).toBeInTheDocument();
    });

    it('shows resume and drop buttons for paused state', () => {
      render(<MeListItemCard item={makeItem({ state: 'paused' }) as never} />);

      expect(screen.getByText('Продовжити')).toBeInTheDocument();
      expect(screen.getByText('Покинути')).toBeInTheDocument();
    });

    it('shows only drop button for planned state', () => {
      render(<MeListItemCard item={makeItem({ state: 'planned' }) as never} />);

      expect(screen.getByText('Покинути')).toBeInTheDocument();
      expect(screen.queryByText('На паузу')).not.toBeInTheDocument();
      expect(screen.queryByText('Продовжити')).not.toBeInTheDocument();
      expect(screen.queryByText('Повернути')).not.toBeInTheDocument();
    });

    it('shows only restore button for dropped state', () => {
      render(<MeListItemCard item={makeItem({ state: 'dropped' }) as never} />);

      expect(screen.getByText('Повернути')).toBeInTheDocument();
      expect(screen.queryByText('На паузу')).not.toBeInTheDocument();
      expect(screen.queryByText('Продовжити')).not.toBeInTheDocument();
      expect(screen.queryByText('Покинути')).not.toBeInTheDocument();
    });

    it('shows no action buttons for completed state', () => {
      render(<MeListItemCard item={makeItem({ state: 'completed' }) as never} />);

      expect(screen.queryByText('На паузу')).not.toBeInTheDocument();
      expect(screen.queryByText('Продовжити')).not.toBeInTheDocument();
      expect(screen.queryByText('Покинути')).not.toBeInTheDocument();
      expect(screen.queryByText('Повернути')).not.toBeInTheDocument();
    });
  });

  /* ---- Drop confirmation dialog ---- */

  describe('Drop confirmation dialog', () => {
    it('opens confirmation dialog on drop click', () => {
      render(<MeListItemCard item={makeItem({ state: 'watching' }) as never} />);

      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Покинути'));

      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
      expect(screen.getByText('Покинути перегляд?')).toBeInTheDocument();
    });

    it('calls dropMutation on confirm', () => {
      render(<MeListItemCard item={makeItem({ state: 'watching' }) as never} />);

      fireEvent.click(screen.getByText('Покинути'));

      // Dialog is now open — find the confirm button inside
      const confirmButtons = screen.getAllByText('Покинути');
      // The last one is the confirm button inside the dialog
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      fireEvent.click(confirmButton);

      expect(mockDropMutate).toHaveBeenCalledWith('media-1', expect.any(Object));
    });

    it('does not call dropMutation on cancel', () => {
      render(<MeListItemCard item={makeItem({ state: 'watching' }) as never} />);

      fireEvent.click(screen.getByText('Покинути'));

      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Скасувати'));

      expect(mockDropMutate).not.toHaveBeenCalled();
    });
  });

  /* ---- Restore action ---- */

  describe('Restore action', () => {
    it('calls restoreMutation on restore click', () => {
      render(<MeListItemCard item={makeItem({ state: 'dropped' }) as never} />);

      fireEvent.click(screen.getByText('Повернути'));

      expect(mockRestoreMutate).toHaveBeenCalledWith('media-1', expect.any(Object));
    });
  });

  /* ---- Pause / Resume ---- */

  describe('Pause / Resume', () => {
    it('calls pauseMutation on pause click', () => {
      render(<MeListItemCard item={makeItem({ state: 'watching' }) as never} />);

      fireEvent.click(screen.getByText('На паузу'));

      expect(mockPauseMutate).toHaveBeenCalledWith('media-1', expect.any(Object));
    });

    it('calls resumeMutation on resume click', () => {
      render(<MeListItemCard item={makeItem({ state: 'paused' }) as never} />);

      fireEvent.click(screen.getByText('Продовжити'));

      expect(mockResumeMutate).toHaveBeenCalledWith('media-1', expect.any(Object));
    });
  });
});
