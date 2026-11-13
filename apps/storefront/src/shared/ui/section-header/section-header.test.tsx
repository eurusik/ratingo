import { render, screen } from '@testing-library/react';
import { SectionHeader } from './section-header';

describe('SectionHeader', () => {
  it('renders the heading, caption and action link', () => {
    render(
      <SectionHeader
        id="trending"
        title="Зараз у тренді"
        caption="Оновлено сьогодні"
        actionHref="/browse"
        actionLabel="Увесь топ"
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Зараз у тренді' })).toHaveAttribute(
      'id',
      'trending',
    );
    expect(screen.getByText('Оновлено сьогодні')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Увесь топ' })).toHaveAttribute('href', '/browse');
  });

  it('omits the action without a link', () => {
    render(<SectionHeader id="mine" title="Твої серіали" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
