import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, getDictionary, type Locale } from '@/shared/i18n';
import { WatchingNowChip } from './watching-now-chip';

function withLocale(locale: Locale) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
        {children}
      </I18nProvider>
    );
  };
}

describe('WatchingNowChip', () => {
  it.each([
    [31, '31', 'Зараз дивиться 31 людина'],
    [32, '32', 'Зараз дивляться 32 людини'],
    [192, '192', 'Зараз дивляться 192 людини'],
    [125, '125', 'Зараз дивляться 125 людей'],
  ])('shows %i as %s and says it in full', (count, short, label) => {
    render(<WatchingNowChip count={count} />, { wrapper: withLocale('uk') });

    expect(screen.getByText(short)).toHaveAttribute('aria-hidden');
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([1234, 1001, 21_500])('shortens %i and keeps the plural right', (count) => {
    render(<WatchingNowChip count={count} />, { wrapper: withLocale('uk') });
    expect(screen.getByText(/тис\.$/)).toHaveAttribute('aria-hidden');
    expect(screen.getByText(/^Зараз дивляться .+ тис\. людей$/)).toBeInTheDocument();
  });

  it('speaks English too', () => {
    render(<WatchingNowChip count={192} />, { wrapper: withLocale('en') });
    expect(screen.getByText('192 people are watching now')).toBeInTheDocument();
  });
});
