import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders the page title as the only h1 with its leading and trailing controls', () => {
    render(
      <PageHeader
        title="Сповіщення"
        leading={<button type="button">Назад</button>}
        actions={<button type="button">Прочитати всі</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Сповіщення' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Прочитати всі' })).toBeInTheDocument();
  });
});
