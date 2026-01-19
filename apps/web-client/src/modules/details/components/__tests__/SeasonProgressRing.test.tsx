import React from 'react';
import { render, screen } from '@testing-library/react';
import { SeasonProgressRing } from '../season-progress-ring';

describe('SeasonProgressRing', () => {
  describe('rendering', () => {
    it('should render progress text for partial completion', () => {
      render(<SeasonProgressRing watched={5} total={10} />);

      expect(screen.getByText('5/10')).toBeInTheDocument();
    });

    it('should show title with watched/total', () => {
      const { container } = render(<SeasonProgressRing watched={3} total={8} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveAttribute('title', '3 / 8');
    });

    it('should not render when total is 0', () => {
      const { container } = render(<SeasonProgressRing watched={0} total={0} />);

      expect(container.firstChild).toBeNull();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SeasonProgressRing watched={1} total={5} className="custom-class" />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('complete state', () => {
    it('should show checkmark when fully watched', () => {
      const { container } = render(<SeasonProgressRing watched={10} total={10} />);

      // Should have a checkmark SVG
      const checkmark = container.querySelector('svg.text-green-500');
      expect(checkmark).toBeInTheDocument();

      // Should not show text
      expect(screen.queryByText('10/10')).not.toBeInTheDocument();
    });

    it('should not show checkmark when partially watched', () => {
      const { container } = render(<SeasonProgressRing watched={9} total={10} />);

      const checkmark = container.querySelector('svg.text-green-500');
      expect(checkmark).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should render with small size by default', () => {
      const { container } = render(<SeasonProgressRing watched={1} total={5} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: '32px', height: '32px' });
    });

    it('should render with medium size when specified', () => {
      const { container } = render(<SeasonProgressRing watched={1} total={5} size="md" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: '40px', height: '40px' });
    });
  });

  describe('progress calculation', () => {
    it('should render SVG with correct structure', () => {
      const { container } = render(<SeasonProgressRing watched={5} total={10} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();

      // Should have 2 circles - background and progress
      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(2);
    });

    it('should handle 0 watched episodes', () => {
      render(<SeasonProgressRing watched={0} total={10} />);

      expect(screen.getByText('0/10')).toBeInTheDocument();
    });

    it('should handle edge case of watched > total', () => {
      // This shouldn't happen in practice, but component should handle it gracefully
      // Component shows text (not checkmark) because isComplete requires exact equality
      const { container } = render(<SeasonProgressRing watched={15} total={10} />);

      // Shows text with over-count
      expect(screen.getByText('15/10')).toBeInTheDocument();

      // No checkmark since watched !== total (only exact equality triggers complete state)
      const checkmark = container.querySelector('svg.text-green-500');
      expect(checkmark).not.toBeInTheDocument();
    });
  });
});
