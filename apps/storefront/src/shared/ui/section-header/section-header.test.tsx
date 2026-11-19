import { fireEvent, render, screen } from '@testing-library/react';
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

  it('names the action link more precisely and reports its clicks', () => {
    const onActionClick = jest.fn();
    render(
      <SectionHeader
        id="upcoming"
        title="Скоро в прокаті"
        actionHref="/calendar?type=movie"
        actionLabel="Календар →"
        actionAriaLabel="Календар фільмів"
        onActionClick={onActionClick}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Календар фільмів' }), { metaKey: true });
    expect(onActionClick).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('link', { name: 'Календар фільмів' })).toHaveAttribute(
      'href',
      '/calendar?type=movie',
    );
  });

  it('omits the action without a link', () => {
    render(<SectionHeader id="mine" title="Твої серіали" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
