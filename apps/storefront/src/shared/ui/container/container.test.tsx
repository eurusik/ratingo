import { render, screen } from '@testing-library/react';
import { Container } from './container';

describe('Container', () => {
  it('renders the page container as the element it is given', () => {
    render(
      <Container as="section" aria-label="Тренди" className="py-6">
        Зміст
      </Container>,
    );

    const section = screen.getByRole('region', { name: 'Тренди' });
    expect(section).toHaveClass('page-container', 'py-6');
    expect(section).toHaveTextContent('Зміст');
  });

  it('is a div by default', () => {
    const { container } = render(<Container>Зміст</Container>);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });
});
