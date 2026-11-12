import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, getDictionary, type Locale } from '@/shared/i18n';
import { ScoreChip, useScoreLabel } from './score-chip';

function withLocale(locale: Locale) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
        {children}
      </I18nProvider>
    );
  };
}

describe('ScoreChip', () => {
  it.each([
    [8.4, '8,4 · Варто'],
    [6, '6,0 · Сумнівно'],
    [3.2, '3,2 · Слабко'],
  ])('shows %s with its verdict', (score, text) => {
    render(<ScoreChip score={score} />, { wrapper: withLocale('uk') });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('formats the score for the English locale', () => {
    render(<ScoreChip score={7.25} />, { wrapper: withLocale('en') });
    expect(screen.getByText(/^7\.3 · /)).toBeInTheDocument();
  });

  it('builds a spoken label for rows that need one', () => {
    const { result } = renderHook(() => useScoreLabel(), { wrapper: withLocale('uk') });
    expect(result.current(8)).toBe('Оцінка 8,0: Варто');
  });
});
