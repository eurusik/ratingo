import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@heroui/react/toast';
import { useAuth } from '@ratingo/web-core/auth';
import {
  libraryApi,
  reviewsApi,
  type Review,
  type ReviewPage,
  type UserMediaState,
} from '@/shared/api';
import { closeAuth, useAuthRequest } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { reportedReviews } from '../model/hidden-reviews';
import { MediaReviews } from './media-reviews';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/shared/api', () => ({
  libraryApi: { getMediaState: jest.fn(), getRatings: jest.fn() },
  reviewsApi: {
    listForMedia: jest.fn(),
    getMine: jest.fn(),
    create: jest.fn(),
    report: jest.fn(),
    vote: jest.fn(),
    unvote: jest.fn(),
  },
}));

const DUNE = { mediaItemId: 'dune-id', type: 'movie' as const, slug: 'dune-2', title: 'Дюна' };

function reviewBy(username: string, extra: Partial<Review> = {}): Review {
  return {
    id: `${username}-review`,
    mediaItemId: DUNE.mediaItemId,
    content: `Відгук від ${username}`,
    rating: 90,
    hasSpoiler: false,
    likesCount: 4,
    dislikesCount: 0,
    repliesCount: 0,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    author: {
      id: `${username}-id`,
      username,
      avatarUrl: null,
      showRatings: true,
      isProfilePublic: true,
    },
    currentUserVote: null,
    ...extra,
  };
}

function signIn(userId: string | null) {
  jest.mocked(useAuth).mockReturnValue({
    isAuthenticated: userId !== null,
    isLoading: false,
    user: userId ? { id: userId } : null,
  } as ReturnType<typeof useAuth>);
}

function AuthRequestProbe() {
  return useAuthRequest() ? <p>auth requested</p> : null;
}

function renderReviews(initialPage: ReviewPage | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <MediaReviews
          media={DUNE}
          community={{ averageScore: 8.1, ratingCount: 214 }}
          initialPage={initialPage}
        />
        <AuthRequestProbe />
        <ToastProvider />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function listing(reviews: Review[], total = reviews.length) {
  jest.mocked(reviewsApi.listForMedia).mockResolvedValue({ reviews, total });
}

describe('MediaReviews', () => {
  beforeEach(() => {
    jest.mocked(reviewsApi.getMine).mockResolvedValue(null);
    jest.mocked(libraryApi.getMediaState).mockResolvedValue(null);
  });

  afterEach(() => {
    act(() => closeAuth());
    jest.clearAllMocks();
  });

  it('shows the top reviews and links to the full list', async () => {
    signIn(null);
    listing([reviewBy('olya'), reviewBy('max'), reviewBy('andrii')], 128);
    renderReviews();

    expect(await screen.findByRole('article', { name: 'Відгук olya' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Усі 128 відгуків' })).toHaveAttribute(
      'href',
      '/movies/dune-2/reviews',
    );
    expect(screen.getByText('Дивився? Розкажи, як тобі')).toBeInTheDocument();
  });

  it('shows the reviews rendered on the server without asking again', async () => {
    signIn(null);
    renderReviews({ reviews: [reviewBy('olya')], total: 1 });

    expect(screen.getByRole('article', { name: 'Відгук olya' })).toBeInTheDocument();
    await screen.findByText('Дивився? Розкажи, як тобі');
    expect(reviewsApi.listForMedia).not.toHaveBeenCalled();
  });

  it('keeps the server reviews on screen while a signed-in viewer’s votes load', async () => {
    signIn('me');
    listing([reviewBy('olya', { currentUserVote: 'like', likesCount: 5 })]);
    renderReviews({ reviews: [reviewBy('olya')], total: 1 });

    expect(screen.getByRole('button', { name: 'Корисний відгук, 4' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Корисний відгук, 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('hides a spoiler until the reader asks for it', async () => {
    signIn(null);
    listing([reviewBy('max', { hasSpoiler: true, content: 'Пол стає імператором' })]);
    renderReviews();

    const card = await screen.findByRole('article', { name: 'Відгук max' });
    fireEvent.click(within(card).getByRole('button', { name: 'Спойлер · показати' }));

    expect(within(card).getByText('Пол стає імператором')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Спойлер · показати' })).toBeNull();
  });

  it('asks a guest to sign in before writing the first review', async () => {
    signIn(null);
    listing([]);
    renderReviews();

    fireEvent.click(await screen.findByRole('button', { name: 'Написати відгук' }));

    expect(await screen.findByText('auth requested')).toBeInTheDocument();
  });

  it('invites a viewer who rated the movie to add a few words and publishes with that rating', async () => {
    signIn('me');
    listing([reviewBy('olya')]);
    jest
      .mocked(libraryApi.getMediaState)
      .mockResolvedValue({ mediaItemId: DUNE.mediaItemId, rating: 75 } as UserMediaState);
    jest.mocked(reviewsApi.create).mockResolvedValue({} as never);
    renderReviews();

    fireEvent.click(await screen.findByRole('button', { name: /Твоя оцінка: 🙂 7,5/ }));
    const text = await screen.findByRole('textbox', { name: 'Текст відгуку' });
    fireEvent.change(text, { target: { value: 'Звук — окремий персонаж' } });
    fireEvent.click(screen.getByRole('button', { name: 'Опублікувати' }));

    await waitFor(() =>
      expect(reviewsApi.create).toHaveBeenCalledWith('dune-id', 'movie', {
        content: 'Звук — окремий персонаж',
        rating: 75,
        hasSpoiler: false,
      }),
    );
  });

  it('puts the viewer’s own review first without a vote of its own', async () => {
    signIn('mine-id');
    const mine = reviewBy('mine');
    listing([reviewBy('olya'), mine]);
    jest.mocked(reviewsApi.getMine).mockResolvedValue(mine);
    renderReviews();

    await screen.findByRole('article', { name: 'Відгук mine' });
    const [first] = screen.getAllByRole('article');
    expect(within(first!).getByText('ти')).toBeInTheDocument();
    expect(within(first!).getByRole('button', { name: 'Редагувати' })).toBeInTheDocument();
    expect(within(first!).getByRole('button', { name: 'Корисний відгук, 4' })).toBeDisabled();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('counts a helpful vote at once', async () => {
    signIn('me');
    listing([reviewBy('olya')]);
    jest.mocked(reviewsApi.vote).mockResolvedValue({ action: 'added', currentVote: 'like' });
    renderReviews();

    fireEvent.click(await screen.findByRole('button', { name: 'Корисний відгук, 4' }));

    expect(await screen.findByRole('button', { name: 'Корисний відгук, 5' })).toBeInTheDocument();
    expect(reviewsApi.vote).toHaveBeenCalledWith('olya-review', 'like');
  });

  it('collapses a review for the viewer after reporting it', async () => {
    signIn('me');
    listing([reviewBy('troll')]);
    jest.mocked(reviewsApi.report).mockResolvedValue({} as never);
    renderReviews();

    fireEvent.click(await screen.findByRole('button', { name: 'Ще дії з відгуком' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Поскаржитись' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Надіслати скаргу' }));
    expect(await screen.findByText('Вибери причину, щоб ми знали, що перевірити')).toHaveAttribute(
      'role',
      'alert',
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Спам або реклама' }));
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати скаргу' }));

    await waitFor(() =>
      expect(reviewsApi.report).toHaveBeenCalledWith('troll-review', 'spam', undefined),
    );
    expect(await screen.findByText('Ти поскаржився на відгук troll')).toBeInTheDocument();
    act(() => reportedReviews.remove('troll-review'));
  });
});
