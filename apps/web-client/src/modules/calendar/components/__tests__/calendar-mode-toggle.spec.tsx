/**
 * Tests for CalendarModeToggle component.
 *
 * Verifies ARIA state, active/inactive visual state, and click callbacks.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarModeToggle } from '../calendar-mode-toggle';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

jest.mock('@/shared/i18n', () => ({
  getDictionary: () => ({
    calendar: {
      title: 'Календар серій',
      modeAll: 'Всі',
      modePersonalized: 'Персоналізований',
    },
  }),
}));

jest.mock('@/shared/utils', () => ({
  cn: (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' '),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CalendarModeToggle', () => {
  const onModeChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders both tabs', () => {
    render(<CalendarModeToggle mode="all" onModeChange={onModeChange} />);

    expect(screen.getByRole('tab', { name: 'Всі' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Персоналізований' })).toBeInTheDocument();
  });

  it('marks "all" tab as selected when mode is "all"', () => {
    render(<CalendarModeToggle mode="all" onModeChange={onModeChange} />);

    expect(screen.getByRole('tab', { name: 'Всі' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Персоналізований' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('marks "personalized" tab as selected when mode is "personalized"', () => {
    render(<CalendarModeToggle mode="personalized" onModeChange={onModeChange} />);

    expect(screen.getByRole('tab', { name: 'Персоналізований' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Всі' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onModeChange("personalized") when personalized tab is clicked', () => {
    render(<CalendarModeToggle mode="all" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Персоналізований' }));

    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('personalized');
  });

  it('calls onModeChange("all") when all tab is clicked', () => {
    render(<CalendarModeToggle mode="personalized" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Всі' }));

    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('all');
  });

  it('renders a tablist container with accessible label', () => {
    render(<CalendarModeToggle mode="all" onModeChange={onModeChange} />);

    expect(screen.getByRole('tablist', { name: 'Календар серій' })).toBeInTheDocument();
  });
});
