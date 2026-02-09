/**
 * Tests for ListSortSelect component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ListSortSelect } from '../list-sort-select';
import type { MeListSort } from '../../hooks/use-me-lists';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const fullDict = {
  activity: {
    sort: {
      label: 'Sorting',
      recent: 'Recent',
      rating: 'By Rating',
      releaseDate: 'By Release Date',
    },
  },
};

let mockDict: Record<string, unknown> = fullDict;

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ dict: mockDict }),
}));

jest.mock('lucide-react', () => ({
  ArrowDownUp: ({ className }: { className?: string }) => (
    <svg data-testid="arrow-icon" className={className} />
  ),
}));

jest.mock('@/shared/ui', () => ({
  Select: ({ children, value, onValueChange }: any) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(e.target.value);
    };
    return (
      <div data-testid="select" data-value={value}>
        {children}
        <input
          data-testid="select-trigger"
          value={value}
          onChange={handleChange}
          readOnly
        />
      </div>
    );
  },
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: any) => (
    <div data-testid={`option-${value}`}>{children}</div>
  ),
  SelectTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  SelectValue: () => null,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('ListSortSelect', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDict = fullDict;
  });

  it('renders all three sort options', () => {
    render(<ListSortSelect value="recent" onChange={mockOnChange} />);

    expect(screen.getByTestId('option-recent')).toBeInTheDocument();
    expect(screen.getByTestId('option-rating')).toBeInTheDocument();
    expect(screen.getByTestId('option-releaseDate')).toBeInTheDocument();
  });

  it('renders with correct aria-label from dict', () => {
    render(<ListSortSelect value="recent" onChange={mockOnChange} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-label', 'Sorting');
  });

  it('uses Ukrainian fallback when dict is empty', () => {
    mockDict = {};
    render(<ListSortSelect value="recent" onChange={mockOnChange} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-label', 'Сортування');
  });

  it('renders translated labels for each option', () => {
    render(<ListSortSelect value="recent" onChange={mockOnChange} />);

    expect(screen.getByTestId('option-recent')).toHaveTextContent('Recent');
    expect(screen.getByTestId('option-rating')).toHaveTextContent('By Rating');
    expect(screen.getByTestId('option-releaseDate')).toHaveTextContent('By Release Date');
  });

  it('renders Ukrainian fallback labels when translations missing', () => {
    mockDict = {};
    render(<ListSortSelect value="recent" onChange={mockOnChange} />);

    expect(screen.getByTestId('option-recent')).toHaveTextContent('Нещодавні');
    expect(screen.getByTestId('option-rating')).toHaveTextContent('За оцінкою');
    expect(screen.getByTestId('option-releaseDate')).toHaveTextContent('За датою виходу');
  });

  it('calls onChange with valid sort value', () => {
    render(<ListSortSelect value="recent" onChange={mockOnChange} />);

    const trigger = screen.getByTestId('select-trigger');
    fireEvent.change(trigger, { target: { value: 'rating' } });

    expect(mockOnChange).toHaveBeenCalledWith('rating');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange with invalid sort value', () => {
    render(<ListSortSelect value="recent" onChange={mockOnChange} />);

    const trigger = screen.getByTestId('select-trigger');
    fireEvent.change(trigger, { target: { value: 'invalid-sort' } });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('renders with current value', () => {
    render(<ListSortSelect value="rating" onChange={mockOnChange} />);

    const select = screen.getByTestId('select');
    expect(select).toHaveAttribute('data-value', 'rating');
  });

  describe('isMeListSort type guard', () => {
    it('accepts valid "recent" value', () => {
      const onChange = jest.fn();
      render(<ListSortSelect value="rating" onChange={onChange} />);

      const trigger = screen.getByTestId('select-trigger');
      fireEvent.change(trigger, { target: { value: 'recent' } });

      expect(onChange).toHaveBeenCalledWith('recent');
    });

    it('accepts valid "rating" value', () => {
      render(<ListSortSelect value="recent" onChange={mockOnChange} />);

      const trigger = screen.getByTestId('select-trigger');
      fireEvent.change(trigger, { target: { value: 'rating' } });

      expect(mockOnChange).toHaveBeenCalledWith('rating');
    });

    it('accepts valid "releaseDate" value', () => {
      render(<ListSortSelect value="recent" onChange={mockOnChange} />);

      const trigger = screen.getByTestId('select-trigger');
      fireEvent.change(trigger, { target: { value: 'releaseDate' } });

      expect(mockOnChange).toHaveBeenCalledWith('releaseDate');
    });

    it('rejects invalid empty string', () => {
      render(<ListSortSelect value="recent" onChange={mockOnChange} />);

      const trigger = screen.getByTestId('select-trigger');
      fireEvent.change(trigger, { target: { value: '' } });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('rejects invalid arbitrary string', () => {
      render(<ListSortSelect value="recent" onChange={mockOnChange} />);

      const trigger = screen.getByTestId('select-trigger');
      fireEvent.change(trigger, { target: { value: 'popularity' } });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('rejects invalid numeric string', () => {
      render(<ListSortSelect value="recent" onChange={mockOnChange} />);

      const trigger = screen.getByTestId('select-trigger');
      fireEvent.change(trigger, { target: { value: '123' } });

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });
});
