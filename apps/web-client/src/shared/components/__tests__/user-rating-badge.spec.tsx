/**
 * Tests for UserRatingBadge component.
 */

import { render, screen } from '@testing-library/react';
import { UserRatingBadge } from '../user-rating-badge';

describe('UserRatingBadge', () => {
  it('renders rating number and emoji for a high score', () => {
    render(<UserRatingBadge rating={90} />);

    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('renders rating number and emoji for a low score', () => {
    render(<UserRatingBadge rating={15} />);

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('💀')).toBeInTheDocument();
  });

  it('renders title and aria-label from label prop', () => {
    render(<UserRatingBadge rating={75} label="Ваша оцінка: 75" />);

    expect(screen.getByTitle('Ваша оцінка: 75')).toBeInTheDocument();
    expect(screen.getByLabelText('Ваша оцінка: 75')).toBeInTheDocument();
  });

  it('does not render title or aria-label when label prop is omitted', () => {
    const { container } = render(<UserRatingBadge rating={75} />);

    const badge = container.firstChild as HTMLElement;
    expect(badge).not.toHaveAttribute('title');
    expect(badge).not.toHaveAttribute('aria-label');
  });

  it('renders User icon', () => {
    const { container } = render(<UserRatingBadge rating={50} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies rounded-full border styling', () => {
    const { container } = render(<UserRatingBadge rating={50} />);

    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('border');
    expect(badge).toHaveClass('border-white/20');
  });
});
