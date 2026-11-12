import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { MobileDock } from './mobile-dock';

jest.mock('next/navigation', () => ({
  usePathname: () => '/browse/movies',
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
    expect(screen.getByRole('link', { name: uk.nav.browse })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: uk.nav.today })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: uk.nav.search })).toBeInTheDocument();
  });

  it('opens search in a sheet', async () => {
    renderDock();

    fireEvent.click(screen.getByRole('button', { name: uk.nav.search }));

    expect(await screen.findByRole('dialog', { name: uk.search.title })).toHaveTextContent(
      uk.search.comingSoon,
    );
  });
});
