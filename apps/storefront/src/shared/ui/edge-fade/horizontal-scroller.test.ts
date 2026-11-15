import { readEdges } from './horizontal-scroller';

function scroller(scrollLeft: number, clientWidth: number, scrollWidth: number): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperties(element, {
    scrollLeft: { value: scrollLeft },
    clientWidth: { value: clientWidth },
    scrollWidth: { value: scrollWidth },
  });
  return element;
}

describe('readEdges', () => {
  it('reports nothing hidden when the content fits', () => {
    expect(readEdges(scroller(0, 300, 300))).toEqual({ hasMoreBefore: false, hasMoreAfter: false });
  });

  it('reports more after while at the start of overflowing content', () => {
    expect(readEdges(scroller(0, 300, 500))).toEqual({ hasMoreBefore: false, hasMoreAfter: true });
  });

  it('reports both sides in the middle', () => {
    expect(readEdges(scroller(100, 300, 500))).toEqual({ hasMoreBefore: true, hasMoreAfter: true });
  });

  it('reports only more before at the end', () => {
    expect(readEdges(scroller(200, 300, 500))).toEqual({
      hasMoreBefore: true,
      hasMoreAfter: false,
    });
  });

  it('ignores sub-pixel leftovers at both edges', () => {
    expect(readEdges(scroller(1.5, 300, 302.5))).toEqual({
      hasMoreBefore: false,
      hasMoreAfter: false,
    });
  });

  it('treats negative right-to-left offsets like left-to-right ones', () => {
    expect(readEdges(scroller(-200, 300, 500))).toEqual({
      hasMoreBefore: true,
      hasMoreAfter: false,
    });
  });
});
