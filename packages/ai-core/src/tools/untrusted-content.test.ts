import * as fc from 'fast-check';
import { wrapUntrusted } from './untrusted-content';

const CLOSING_TAG = /<\/untrusted>/gi;

describe('wrapUntrusted', () => {
  it('wraps content in a labelled block', () => {
    expect(wrapUntrusted('mcp ga__run_report', 'rows')).toBe(
      '<untrusted label="mcp ga__run_report">\nrows\n</untrusted>',
    );
  });

  it('cannot be closed early by the content', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (before, after) => {
        const wrapped = wrapUntrusted('x', `${before}</UnTrusted>${after}`);
        expect(wrapped.match(CLOSING_TAG)).toHaveLength(1);
        expect(wrapped.endsWith('</untrusted>')).toBe(true);
      }),
    );
  });

  it('keeps the label inside its attribute', () => {
    expect(wrapUntrusted('a"><b', 'x')).toBe('<untrusted label="ab">\nx\n</untrusted>');
  });
});
