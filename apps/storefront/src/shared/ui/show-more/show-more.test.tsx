import { act, fireEvent, render, screen } from '@testing-library/react';
import { ShowMore } from './show-more';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let reach: ObserverCallback | undefined;

beforeEach(() => {
  reach = undefined;
  window.IntersectionObserver = jest.fn((callback: ObserverCallback) => {
    reach = callback;
    return { observe: jest.fn(), disconnect: jest.fn() };
  }) as unknown as typeof IntersectionObserver;
});

function renderShowMore(onMore: () => void, rearmKey = 1) {
  return render(
    <ShowMore
      hasMore
      label="Показати ще"
      loadingLabel="Завантаження"
      rearmKey={rearmKey}
      onMore={onMore}
    />,
  );
}

describe('ShowMore', () => {
  it('waits for the first press, then keeps loading as the end scrolls into view', () => {
    const onMore = jest.fn();
    const { rerender } = renderShowMore(onMore);

    expect(reach).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Показати ще' }));
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <ShowMore
        hasMore
        label="Показати ще"
        loadingLabel="Завантаження"
        rearmKey={2}
        onMore={onMore}
      />,
    );
    act(() => reach?.([{ isIntersecting: true }]));
    expect(onMore).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when everything is shown', () => {
    const { container } = render(
      <ShowMore
        hasMore={false}
        label="Показати ще"
        loadingLabel="Завантаження"
        rearmKey={1}
        onMore={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
