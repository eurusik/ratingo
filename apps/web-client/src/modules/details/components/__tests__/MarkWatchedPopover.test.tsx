import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkWatchedPopover } from '../mark-watched-popover';

const defaultLabels = {
  markAsWatched: 'Mark as watched',
  thisEpisodeOnly: 'This episode only',
  previousEpisodesToo: 'Previous episodes too',
};

describe('MarkWatchedPopover', () => {
  const defaultProps = {
    isWatched: false,
    unwatchedPreviousCount: 0,
    onMarkThis: jest.fn(),
    onMarkWithPrevious: jest.fn(),
    onUnmark: jest.fn(),
    labels: defaultLabels,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when already watched', () => {
    it('should render simple checkbox for unmark', () => {
      render(<MarkWatchedPopover {...defaultProps} isWatched={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should call onUnmark when clicked', () => {
      const onUnmark = jest.fn();
      render(<MarkWatchedPopover {...defaultProps} isWatched={true} onUnmark={onUnmark} />);

      fireEvent.click(screen.getByRole('checkbox'));

      expect(onUnmark).toHaveBeenCalledTimes(1);
    });
  });

  describe('when no unwatched previous episodes', () => {
    it('should render simple checkbox', () => {
      render(<MarkWatchedPopover {...defaultProps} unwatchedPreviousCount={0} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should call onMarkThis when clicked', () => {
      const onMarkThis = jest.fn();
      render(
        <MarkWatchedPopover {...defaultProps} unwatchedPreviousCount={0} onMarkThis={onMarkThis} />,
      );

      fireEvent.click(screen.getByRole('checkbox'));

      expect(onMarkThis).toHaveBeenCalledTimes(1);
    });
  });

  describe('when has unwatched previous episodes', () => {
    it('should render dropdown trigger', () => {
      render(<MarkWatchedPopover {...defaultProps} unwatchedPreviousCount={3} />);

      // Should have a checkbox that acts as dropdown trigger
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should show dropdown menu when open', () => {
      // Use controlled state since Radix renders in portal
      render(
        <MarkWatchedPopover {...defaultProps} unwatchedPreviousCount={3} open={true} />,
      );

      // Menu should appear with options
      expect(screen.getByText('Mark as watched')).toBeInTheDocument();
      expect(screen.getByText('This episode only')).toBeInTheDocument();
      expect(screen.getByText('Previous episodes too')).toBeInTheDocument();
    });

    it('should call onMarkThis when "This episode only" is clicked', () => {
      const onMarkThis = jest.fn();
      const onOpenChange = jest.fn();
      render(
        <MarkWatchedPopover
          {...defaultProps}
          unwatchedPreviousCount={3}
          open={true}
          onOpenChange={onOpenChange}
          onMarkThis={onMarkThis}
        />,
      );

      fireEvent.click(screen.getByText('This episode only'));

      expect(onMarkThis).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should call onMarkWithPrevious when "Previous episodes too" is clicked', () => {
      const onMarkWithPrevious = jest.fn();
      const onOpenChange = jest.fn();
      render(
        <MarkWatchedPopover
          {...defaultProps}
          unwatchedPreviousCount={3}
          open={true}
          onOpenChange={onOpenChange}
          onMarkWithPrevious={onMarkWithPrevious}
        />,
      );

      fireEvent.click(screen.getByText('Previous episodes too'));

      expect(onMarkWithPrevious).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

  });

  describe('disabled state', () => {
    it('should disable checkbox when disabled prop is true', () => {
      render(<MarkWatchedPopover {...defaultProps} disabled={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });

    it('should disable checkbox when isLoading is true', () => {
      render(<MarkWatchedPopover {...defaultProps} isLoading={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });
  });
});
