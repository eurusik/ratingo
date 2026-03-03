/**
 * Tests for CalendarModeToggle component.
 *
 * Verifies ARIA state, active/inactive visual state, and click callbacks.
 */

import React from 'react';
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

/**
 * Minimal Tabs mock — simulates Radix value/onValueChange context wiring
 * so that fireEvent.click works in jsdom without full Radix internals.
 */
jest.mock('@/shared/ui', () => {
  function Tabs({ value, onValueChange, children }: any) {
    return (
      <div>
        {React.Children.map(children, (child: any) =>
          child
            ? React.cloneElement(child, { _tabsValue: value, _onValueChange: onValueChange })
            : child,
        )}
      </div>
    );
  }

  function TabsList({ children, _tabsValue, _onValueChange, className, 'aria-label': ariaLabel }: any) {
    return (
      <div role="tablist" aria-label={ariaLabel} className={className}>
        {React.Children.map(children, (child: any) =>
          child ? React.cloneElement(child, { _tabsValue, _onValueChange }) : child,
        )}
      </div>
    );
  }

  function TabsTrigger({ value, children, _tabsValue, _onValueChange, className }: any) {
    const isSelected = value === _tabsValue;
    return (
      <button
        role="tab"
        aria-selected={isSelected}
        className={className}
        onClick={() => !isSelected && _onValueChange?.(value)}
      >
        {children}
      </button>
    );
  }

  return { Tabs, TabsList, TabsTrigger };
});

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

  it('does not call onModeChange when already-active tab is clicked', () => {
    render(<CalendarModeToggle mode="all" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Всі' }));

    expect(onModeChange).not.toHaveBeenCalled();
  });

  it('renders a tablist container with accessible label', () => {
    render(<CalendarModeToggle mode="all" onModeChange={onModeChange} />);

    expect(screen.getByRole('tablist', { name: 'Календар серій' })).toBeInTheDocument();
  });
});
