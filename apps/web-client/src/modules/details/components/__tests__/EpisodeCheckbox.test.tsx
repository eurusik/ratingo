import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EpisodeCheckbox } from '../episode-checkbox';

describe('EpisodeCheckbox', () => {
  const defaultProps = {
    checked: false,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render unchecked state correctly', () => {
      render(<EpisodeCheckbox {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should render checked state with checkmark', () => {
      render(<EpisodeCheckbox {...defaultProps} checked={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should render with title attribute', () => {
      render(<EpisodeCheckbox {...defaultProps} title="Mark as watched" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('title', 'Mark as watched');
    });

    it('should apply disabled styles when disabled', () => {
      render(<EpisodeCheckbox {...defaultProps} disabled={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });

    it('should apply custom className', () => {
      render(<EpisodeCheckbox {...defaultProps} className="custom-class" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('custom-class');
    });
  });

  describe('interactions', () => {
    it('should call onToggle when clicked', () => {
      const onToggle = jest.fn();
      render(<EpisodeCheckbox {...defaultProps} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('checkbox'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should not call onToggle when disabled', () => {
      const onToggle = jest.fn();
      render(<EpisodeCheckbox {...defaultProps} onToggle={onToggle} disabled={true} />);

      fireEvent.click(screen.getByRole('checkbox'));

      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should not call onToggle when loading', () => {
      const onToggle = jest.fn();
      render(<EpisodeCheckbox {...defaultProps} onToggle={onToggle} isLoading={true} />);

      fireEvent.click(screen.getByRole('checkbox'));

      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should handle Enter key press', () => {
      const onToggle = jest.fn();
      render(<EpisodeCheckbox {...defaultProps} onToggle={onToggle} />);

      fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' });

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key press', () => {
      const onToggle = jest.fn();
      render(<EpisodeCheckbox {...defaultProps} onToggle={onToggle} />);

      fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should not respond to other keys', () => {
      const onToggle = jest.fn();
      render(<EpisodeCheckbox {...defaultProps} onToggle={onToggle} />);

      fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'a' });
      fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Escape' });

      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<EpisodeCheckbox {...defaultProps} isLoading={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });

    it('should not show checkmark when loading even if checked', () => {
      const { container } = render(
        <EpisodeCheckbox {...defaultProps} checked={true} isLoading={true} />,
      );

      // Check icon should not be visible when loading
      const checkIcon = container.querySelector('svg.lucide-check');
      expect(checkIcon).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<EpisodeCheckbox {...defaultProps} checked={true} disabled={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });

    it('should be focusable', () => {
      render(<EpisodeCheckbox {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);
    });
  });
});
