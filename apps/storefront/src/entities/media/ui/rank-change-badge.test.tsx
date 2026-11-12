import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { RankChangeBadge } from './rank-change-badge';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
      {children}
    </I18nProvider>
  );
}

describe('RankChangeBadge', () => {
  it.each([
    [{ kind: 'up', places: 3 } as const, '↑ 3', 'піднявся на 3'],
    [{ kind: 'down', places: 2 } as const, '↓ 2', 'опустився на 2'],
    [{ kind: 'new' } as const, 'NEW', 'новинка в топі'],
    [{ kind: 'same' } as const, '—', 'без змін'],
  ])('shows %o as %s and says %s', (change, text, label) => {
    render(<RankChangeBadge change={change} />, { wrapper: Wrapper });
    expect(screen.getByText(text)).toHaveAttribute('aria-hidden');
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
