/**
 * Tests for FilterCountIndicator — thin one-line indicator that surfaces what
 * the active media-type filter hides and offers a one-click reset.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { FilterCountIndicator } from '../filter-count-indicator';

const TEMPLATE = '{hidden} {hiddenItem} приховано';
const ITEM_FORMS = {
  movie: { one: 'фільм', few: 'фільми', many: 'фільмів' },
  show: { one: 'серіал', few: 'серіали', many: 'серіалів' },
};
const RESET_LABEL = 'Показати всі';

function setup(props: Partial<React.ComponentProps<typeof FilterCountIndicator>> = {}) {
  const onReset = jest.fn();
  const view = render(
    <FilterCountIndicator
      mediaType="show"
      filteredTotal={125}
      totalAcrossTypes={438}
      template={TEMPLATE}
      itemForms={ITEM_FORMS}
      resetLabel={RESET_LABEL}
      onReset={onReset}
      locale="uk"
      {...props}
    />,
  );
  return { ...view, onReset };
}

describe('FilterCountIndicator', () => {
  it('renders nothing when mediaType is "all"', () => {
    const { container } = setup({ mediaType: 'all' });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when filtered total equals total across types', () => {
    const { container } = setup({ filteredTotal: 150, totalAcrossTypes: 150 });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when totalAcrossTypes < filteredTotal (degenerate)', () => {
    const { container } = setup({ filteredTotal: 10, totalAcrossTypes: 0 });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows hidden count of the other media type when "show" filter is active', () => {
    setup({ mediaType: 'show', filteredTotal: 125, totalAcrossTypes: 438 });
    expect(screen.getByText('313 фільмів приховано')).toBeInTheDocument();
  });

  it('shows hidden count of shows when "movie" filter is active', () => {
    setup({ mediaType: 'movie', filteredTotal: 66, totalAcrossTypes: 83 });
    expect(screen.getByText('17 серіалів приховано')).toBeInTheDocument();
  });

  it('plural rules — singular form (1 фільм приховано)', () => {
    setup({ mediaType: 'show', filteredTotal: 4, totalAcrossTypes: 5 });
    expect(screen.getByText('1 фільм приховано')).toBeInTheDocument();
  });

  it('plural rules — few form (3 фільми приховано)', () => {
    setup({ mediaType: 'show', filteredTotal: 7, totalAcrossTypes: 10 });
    expect(screen.getByText('3 фільми приховано')).toBeInTheDocument();
  });

  it('renders a "Показати всі" button that fires onReset', () => {
    const { onReset } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Показати всі' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('uses role="status" with aria-live polite for screen readers', () => {
    const { container } = setup();
    const banner = container.querySelector('[role="status"]');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });
});
