import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { RailPager } from './rail-pager';

const CLIENT_WIDTH = 1000;

function Harness({ scrollWidth }: { scrollWidth: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <>
      <RailPager scrollerRef={scroller} />
      <div
        data-testid="scroller"
        ref={(node) => {
          scroller.current = node;
          if (!node) return;
          Object.defineProperty(node, 'clientWidth', { configurable: true, value: CLIENT_WIDTH });
          Object.defineProperty(node, 'scrollWidth', { configurable: true, value: scrollWidth });
          node.scrollBy = jest.fn(({ left }: ScrollToOptions) => {
            node.scrollLeft += left ?? 0;
            node.dispatchEvent(new Event('scroll'));
          }) as unknown as typeof node.scrollBy;
        }}
      />
    </>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
      {children}
    </I18nProvider>
  );
}

describe('RailPager', () => {
  it('pages forward and back and disables the arrow at each end', () => {
    render(<Harness scrollWidth={2700} />, { wrapper: Wrapper });

    const previous = screen.getByRole('button', { name: 'Попередні' });
    const next = screen.getByRole('button', { name: 'Наступні' });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    fireEvent.click(next);
    expect(screen.getByTestId('scroller').scrollBy).toHaveBeenCalledWith({
      left: 850,
      behavior: 'smooth',
    });
    expect(previous).toBeEnabled();

    act(() => {
      fireEvent.click(next);
    });
    expect(next).toBeDisabled();
  });

  it('stays hidden when everything already fits', () => {
    render(<Harness scrollWidth={CLIENT_WIDTH} />, { wrapper: Wrapper });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
