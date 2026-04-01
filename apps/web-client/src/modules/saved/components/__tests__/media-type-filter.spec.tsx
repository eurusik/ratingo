/**
 * Tests for MediaTypeFilter component.
 *
 * Verifies that all three options render, onChange fires with the correct
 * value on selection, and does not fire when the already-selected option
 * is clicked (ToggleGroup returns empty string on deselect).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaTypeFilter } from '../media-type-filter';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const fullDict = {
  mediaType: {
    all: 'Всі',
    movies: 'Фільми',
    shows: 'Серіали',
    label: 'Фільтр за типом',
  },
};

let mockDict: Record<string, unknown> = fullDict;

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ dict: mockDict }),
}));

jest.mock('lucide-react', () => ({
  Film: ({ className }: { className?: string }) => (
    <svg data-testid="film-icon" className={className} />
  ),
  Tv: ({ className }: { className?: string }) => (
    <svg data-testid="tv-icon" className={className} />
  ),
}));

/**
 * Minimal ToggleGroup mock — simulates Radix value/onValueChange wiring
 * so that fireEvent.click works in jsdom without full Radix internals.
 * The group passes its current value down to each item; an item fires
 * onValueChange(item.value) when clicked and is unselected, or fires
 * onValueChange('') when clicked and already selected (Radix behaviour).
 */
jest.mock('@/shared/ui', () => {
  function ToggleGroup({ value, onValueChange, children, className, 'aria-label': ariaLabel }: any) {
    return (
      <div data-testid="toggle-group" data-value={value} className={className} aria-label={ariaLabel}>
        {React.Children.map(children, (child: any) =>
          child
            ? React.cloneElement(child, { _groupValue: value, _onValueChange: onValueChange })
            : child,
        )}
      </div>
    );
  }

  function ToggleGroupItem({
    value,
    children,
    className,
    _groupValue,
    _onValueChange,
  }: any) {
    const isSelected = value === _groupValue;
    return (
      <button
        role="radio"
        aria-checked={isSelected}
        data-testid={`toggle-item-${value}`}
        className={className}
        onClick={() => _onValueChange?.(isSelected ? '' : value)}
      >
        {children}
      </button>
    );
  }

  return { ToggleGroup, ToggleGroupItem };
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('MediaTypeFilter', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDict = fullDict;
  });

  describe('rendering', () => {
    it('renders all three toggle options', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-item-all')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-item-movie')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-item-show')).toBeInTheDocument();
    });

    it('renders translated label for "all" option', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-item-all')).toHaveTextContent('Всі');
    });

    it('renders translated label for "movie" option', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-item-movie')).toHaveTextContent('Фільми');
    });

    it('renders translated label for "show" option', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-item-show')).toHaveTextContent('Серіали');
    });

    it('renders film icon inside the movie option', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      const movieItem = screen.getByTestId('toggle-item-movie');
      expect(movieItem.querySelector('[data-testid="film-icon"]')).toBeInTheDocument();
    });

    it('renders tv icon inside the show option', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      const showItem = screen.getByTestId('toggle-item-show');
      expect(showItem.querySelector('[data-testid="tv-icon"]')).toBeInTheDocument();
    });

    it('uses Ukrainian fallback labels when translations are missing', () => {
      mockDict = {};
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-item-all')).toHaveTextContent('Всі');
      expect(screen.getByTestId('toggle-item-movie')).toHaveTextContent('Фільми');
      expect(screen.getByTestId('toggle-item-show')).toHaveTextContent('Серіали');
    });

    it('sets aria-label on the toggle group from translation', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-group')).toHaveAttribute('aria-label', 'Фільтр за типом');
    });

    it('uses Ukrainian fallback for aria-label when translation is missing', () => {
      mockDict = {};
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-group')).toHaveAttribute('aria-label', 'Фільтр за типом');
    });

    it('reflects the current value on the toggle group', () => {
      render(<MediaTypeFilter value="movie" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-group')).toHaveAttribute('data-value', 'movie');
    });

    it('marks the active item as selected', () => {
      render(<MediaTypeFilter value="show" onChange={mockOnChange} />);

      expect(screen.getByTestId('toggle-item-show')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('toggle-item-all')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('toggle-item-movie')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('onChange behaviour', () => {
    it('calls onChange with "movie" when the movie option is clicked', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      fireEvent.click(screen.getByTestId('toggle-item-movie'));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('movie');
    });

    it('calls onChange with "show" when the show option is clicked', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      fireEvent.click(screen.getByTestId('toggle-item-show'));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('show');
    });

    it('calls onChange with "all" when the all option is clicked', () => {
      render(<MediaTypeFilter value="movie" onChange={mockOnChange} />);

      fireEvent.click(screen.getByTestId('toggle-item-all'));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('all');
    });

    it('does not call onChange when the already-selected option is clicked', () => {
      render(<MediaTypeFilter value="all" onChange={mockOnChange} />);

      fireEvent.click(screen.getByTestId('toggle-item-all'));

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when already-selected "movie" is clicked', () => {
      render(<MediaTypeFilter value="movie" onChange={mockOnChange} />);

      fireEvent.click(screen.getByTestId('toggle-item-movie'));

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when already-selected "show" is clicked', () => {
      render(<MediaTypeFilter value="show" onChange={mockOnChange} />);

      fireEvent.click(screen.getByTestId('toggle-item-show'));

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });
});
