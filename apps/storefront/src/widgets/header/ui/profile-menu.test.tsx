import { fireEvent, render, screen, within } from '@testing-library/react';
import { useAuth, type MeDto } from '@ratingo/web-core/auth';
import { useColorTheme } from '@ratingo/ui/theme';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { ProfileMenu } from './profile-menu';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@ratingo/ui/theme', () => ({ useColorTheme: jest.fn() }));

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

function renderMenu({ isAdmin }: { isAdmin: boolean }) {
  jest
    .mocked(useAuth)
    .mockReturnValue({ logout, isAdmin } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useColorTheme).mockReturnValue({ theme: 'dark', setTheme });
  render(
    <I18nProvider locale="uk" dictionary={uk}>
      <ProfileMenu user={USER} />
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
    expect(
      within(sheet).getByRole('link', { name: `42 ${uk.profile.stats.moviesRated}` }),
    ).toHaveAttribute('href', '/my');
    expect(within(sheet).queryByRole('link', { name: uk.profile.admin })).not.toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('radio', { name: uk.profile.themes.light }));
    expect(setTheme).toHaveBeenCalledWith('light');

    fireEvent.click(within(sheet).getByRole('radio', { name: uk.profile.languages.en }));
    expect(document.cookie).toContain('ratingo-locale=en');
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(within(sheet).getByRole('button', { name: uk.profile.signOut }));
    expect(logout).toHaveBeenCalledTimes(1);
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
});
