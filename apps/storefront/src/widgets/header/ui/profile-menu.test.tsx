import { fireEvent, render, screen, within } from '@testing-library/react';
import { useAuth, type MeDto } from '@ratingo/web-core/auth';
import { useColorTheme } from '@ratingo/ui/theme';
import { useLibraryCounts } from '@/entities/library';
import type { LibraryCounts } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { ProfileMenu } from './profile-menu';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@ratingo/ui/theme', () => ({ useColorTheme: jest.fn() }));
jest.mock('@/entities/library', () => ({
  ...jest.requireActual('@/entities/library'),
  useLibraryCounts: jest.fn(),
}));

const uk = getDictionary('uk');
const logout = jest.fn();
const setTheme = jest.fn();

const USER = {
  username: 'ivan_42',
  email: 'ivan@example.com',
  avatarUrl: null,
  stats: { moviesRated: 42, showsRated: 18, watchlistCount: 77 },
} as MeDto;

function mockViewport(isDesktop: boolean) {
  jest.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: isDesktop && query.includes('min-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function planCounts(forLater: number, considering: number): LibraryCounts {
  return { forLater, considering } as LibraryCounts;
}

function renderMenu({
  isAdmin,
  user = USER,
  counts = planCounts(70, 7),
}: {
  isAdmin: boolean;
  user?: MeDto;
  counts?: LibraryCounts | null;
}) {
  jest.mocked(useLibraryCounts).mockReturnValue(counts ?? undefined);
  jest
    .mocked(useAuth)
    .mockReturnValue({ logout, isAdmin } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useColorTheme).mockReturnValue({ theme: 'dark', setTheme });
  render(
    <I18nProvider locale="uk" dictionary={uk}>
      <ProfileMenu user={user} />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: uk.header.profile }));
}

describe('ProfileMenu', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    document.cookie = 'ratingo-locale=; max-age=0; path=/';
  });

  it('opens a sheet on the phone with stats, theme, language and sign-out', async () => {
    mockViewport(false);
    renderMenu({ isAdmin: false });

    const sheet = await screen.findByRole('dialog', { name: uk.header.profile });
    expect(within(sheet).getByText('ivan@example.com')).toBeInTheDocument();
    const stats = within(sheet).getByRole('list', { name: uk.profile.stats.label });
    expect(
      within(stats).getByRole('link', { name: `${uk.profile.stats.movies}: 42` }),
    ).toHaveAttribute('href', '/my?list=history');
    expect(
      within(stats).getByRole('link', { name: `${uk.profile.stats.watchlist}: 77` }),
    ).toHaveAttribute('href', '/my?list=plan');
    expect(within(sheet).queryByRole('link', { name: uk.profile.admin })).not.toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('radio', { name: uk.profile.themes.light }));
    expect(setTheme).toHaveBeenCalledWith('light');

    fireEvent.click(within(sheet).getByRole('radio', { name: uk.profile.languageNames.en }));
    expect(document.cookie).toContain('ratingo-locale=en');
    expect(refresh).toHaveBeenCalledTimes(1);

    window.gtag = jest.fn();
    fireEvent.click(within(sheet).getByRole('button', { name: uk.profile.signOut }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'logout', {});
    delete window.gtag;
  });

  it('opens a dropdown on desktop with the admin link for admins', async () => {
    mockViewport(true);
    renderMenu({ isAdmin: true });

    const menu = await screen.findByRole('menu', { name: uk.header.profile });
    expect(
      within(menu).getByRole('menuitemradio', { name: uk.profile.themes.dark }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitem', { name: uk.profile.admin })).toHaveAttribute(
      'href',
      'https://ratingo.top/admin',
    );

    fireEvent.click(within(menu).getByRole('menuitem', { name: uk.profile.signOut }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('groups thousands with a narrow no-break space and offers discovery for an empty watchlist', async () => {
    mockViewport(true);
    renderMenu({
      isAdmin: false,
      user: { ...USER, stats: { moviesRated: 2311, showsRated: 514, watchlistCount: 3 } },
      counts: planCounts(0, 0),
    });

    const stats = await screen.findByRole('list', { name: uk.profile.stats.label });
    const { movies, watchlist, emptyWatchlist, find } = uk.profile.stats;
    expect(within(stats).getByRole('link', { name: `${movies}: 2\u202f311` })).toBeInTheDocument();
    expect(
      within(stats).getByRole('link', { name: `${watchlist}: ${emptyWatchlist}. ${find}` }),
    ).toHaveAttribute('href', '/browse');
  });

  it('keeps the watchlist link on the plan list while its count is loading', async () => {
    mockViewport(true);
    renderMenu({ isAdmin: false, counts: null });

    const stats = await screen.findByRole('list', { name: uk.profile.stats.label });
    expect(within(stats).getByRole('link', { name: uk.profile.stats.watchlist })).toHaveAttribute(
      'href',
      '/my?list=plan',
    );
  });
});
