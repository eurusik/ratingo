import { render, screen } from '@testing-library/react';
import { SectionHeader } from './section-header';

describe('SectionHeader', () => {
  it('renders the heading, caption and trailing controls', () => {
    render(
      <SectionHeader
        id="trending"
        title="Зараз у тренді"
        caption="Оновлено сьогодні"
        trailing={<button type="button">Далі</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Зараз у тренді' })).toHaveAttribute(
      'id',
      'trending',
    );
    expect(screen.getByText('Оновлено сьогодні')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Далі' })).toBeInTheDocument();
  });

  it('renders only the heading without a caption or trailing controls', () => {
    const { container } = render(<SectionHeader id="mine" title="Твої серіали" />);

    expect(screen.getByRole('heading', { level: 2, name: 'Твої серіали' })).toBeInTheDocument();
    expect(container.querySelector('p')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
