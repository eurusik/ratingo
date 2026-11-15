import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { openSearch } from '@/features/search';
import { MobileDock } from './mobile-dock';

jest.mock('next/navigation', () => ({
  usePathname: () => '/browse/movies',
}));

jest.mock('@/features/search', () => ({ openSearch: jest.fn() }));

let unreadCount = 0;
jest.mock('@/entities/notification', () => ({
  useUnreadNotificationCount: () => unreadCount,
}));

const uk = getDictionary('uk');

function renderDock() {
  render(
    <I18nProvider locale="uk" dictionary={uk}>
      <MobileDock />
    </I18nProvider>,
  );
}

describe('MobileDock', () => {
  it('lists the four sections and marks the active one', () => {
    renderDock();

    const navigation = screen.getByRole('navigation', { name: uk.nav.label });
    const items = [...navigation.querySelectorAll('a, button')].map((item) => item.textContent);
    expect(items).toEqual([uk.nav.today, uk.nav.browse, uk.nav.calendar, uk.nav.my]);
    expect(screen.getByRole('link', { name: uk.nav.browse })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: uk.nav.today })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: uk.nav.search })).toBeInTheDocument();
  });

  it('opens the shared search', () => {
    renderDock();

    fireEvent.click(screen.getByRole('button', { name: uk.nav.search }));

    expect(openSearch).toHaveBeenCalledTimes(1);
  });

  it('puts an unread dot on My when notifications wait', () => {
    unreadCount = 3;
    renderDock();

    expect(screen.getByRole('link', { name: uk.nav.myUnread })).toHaveAttribute('href', '/my');
    unreadCount = 0;
  });
});
