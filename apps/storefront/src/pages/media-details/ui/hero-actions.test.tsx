import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@heroui/react/toast';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi, type MediaSaveStatus, type UserMediaState } from '@/shared/api';
import { closeAuth, useAuthRequest } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { HeroActions, type ActionMedia } from './hero-actions';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({
  libraryApi: {
    getSaveStatuses: jest.fn(),
    getRatings: jest.fn(),
    getMediaState: jest.fn(),
    setRating: jest.fn(),
    save: jest.fn(),
    unsave: jest.fn(),
  },
}));

const DUNE: ActionMedia = {
  mediaItemId: 'dune-id',
  slug: 'dune-2',
  title: 'Дюна: Частина друга',
  type: 'movie',
};
const SHOGUN: ActionMedia = {
  mediaItemId: 'shogun-id',
  slug: 'shogun',
  title: 'Сьоґун',
  type: 'show',
  seasonCount: 2,
  episodeCount: 20,
};
const FOR_LATER: MediaSaveStatus = { isForLater: true, isConsidering: false };
const NOT_SAVED: MediaSaveStatus = { isForLater: false, isConsidering: false };

function signIn(isAuthenticated: boolean) {
  jest
    .mocked(useAuth)
    .mockReturnValue({ isAuthenticated, isLoading: false } as ReturnType<typeof useAuth>);
}

function AuthRequestProbe() {
  const request = useAuthRequest();
  return request ? <p>auth requested</p> : null;
}

function renderActions(media: ActionMedia) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <HeroActions media={media} />
        <AuthRequestProbe />
        <ToastProvider />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function stateWith(rating: number | null): UserMediaState {
  return { mediaItemId: 'dune-id', rating, state: 'completed' } as UserMediaState;
}

describe('HeroActions', () => {
  let saved = NOT_SAVED;

  beforeEach(() => {
    saved = NOT_SAVED;
    jest.mocked(libraryApi.getSaveStatuses).mockImplementation(async () => ({ 'dune-id': saved }));
    jest.mocked(libraryApi.getRatings).mockResolvedValue({});
    jest.mocked(libraryApi.getMediaState).mockResolvedValue(null);
    jest.mocked(libraryApi.setRating).mockImplementation(async (_id, rating) => stateWith(rating));
    jest.mocked(libraryApi.unsave).mockImplementation(async () => {
      saved = NOT_SAVED;
      return saved;
    });
  });

  afterEach(() => {
    act(() => closeAuth());
    jest.clearAllMocks();
  });

  it('rates a movie with a preset and turns the main action into the watched score', async () => {
    signIn(true);
    renderActions(DUNE);

    fireEvent.click(await screen.findByRole('button', { name: 'Оцінити' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Топ/ }));

    await waitFor(() => expect(libraryApi.setRating).toHaveBeenCalledWith('dune-id', 90, 'movie'));
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(
      await screen.findByRole('button', { name: 'Переглянуто · 9,0. Змінити оцінку' }),
    ).toBeInTheDocument();
  });

  it('takes a rated movie out of the saved list and offers to undo', async () => {
    saved = FOR_LATER;
    signIn(true);
    renderActions(DUNE);
    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: 'Оцінити' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Сподобалось/ }));

    await waitFor(() => expect(libraryApi.unsave).toHaveBeenCalledWith('dune-id', 'for_later'));
    expect(await screen.findByText('🙂 7,5 · прибрано зі збереженого')).toBeInTheDocument();
  });

  it('keeps the sheet open after the first pick so the score can be fine-tuned', async () => {
    signIn(true);
    renderActions(DUNE);

    fireEvent.click(await screen.findByRole('button', { name: 'Оцінити' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Норм/ }));

    await waitFor(() => expect(libraryApi.setRating).toHaveBeenCalledWith('dune-id', 50, 'movie'));
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Норм/ })).toBeChecked();
  });

  it('removes a rating from the sheet and offers to undo', async () => {
    jest.mocked(libraryApi.getMediaState).mockResolvedValue(stateWith(75));
    signIn(true);
    renderActions(DUNE);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Переглянуто · 7,5. Змінити оцінку' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Прибрати' }));

    await waitFor(() =>
      expect(libraryApi.setRating).toHaveBeenCalledWith('dune-id', null, 'movie'),
    );
    expect(await screen.findByRole('button', { name: 'Оцінити' })).toBeInTheDocument();

    expect(await screen.findByText('Оцінку прибрано')).toBeInTheDocument();
    const [undo] = await screen.findAllByRole('button', { name: 'Скасувати' });
    fireEvent.click(undo!);
    await waitFor(() =>
      expect(libraryApi.setRating).toHaveBeenLastCalledWith('dune-id', 75, 'movie'),
    );
  });

  it('asks a guest to sign in before rating', async () => {
    signIn(false);
    renderActions(DUNE);

    fireEvent.click(screen.getByRole('button', { name: 'Оцінити' }));

    expect(await screen.findByText('auth requested')).toBeInTheDocument();
    expect(libraryApi.setRating).not.toHaveBeenCalled();
  });

  it('offers a guest to sign in and start tracking a show', async () => {
    signIn(false);
    renderActions(SHOGUN);

    fireEvent.click(screen.getByRole('button', { name: 'Увійти й почати' }));

    expect(await screen.findByText('auth requested')).toBeInTheDocument();
  });

  it('shows the start card with seasons and episodes to a signed-in viewer of a show', async () => {
    signIn(true);
    renderActions(SHOGUN);

    expect(await screen.findByRole('heading', { name: 'Ще не дивишся?' })).toBeInTheDocument();
    expect(screen.getByText('2 сезони · 20 серій')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Хочу подивитись' })).toBeInTheDocument();
  });
});
