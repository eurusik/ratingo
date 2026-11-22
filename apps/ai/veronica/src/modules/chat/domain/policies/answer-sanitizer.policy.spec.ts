import { clip, stripLinks } from './answer-sanitizer.policy';

describe('stripLinks', () => {
  it('keeps the text of an anchor and drops the address', () => {
    expect(stripLinks('Дивись <a href="https://evil.example">тут</a>.')).toBe('Дивись тут.');
  });

  it.each([
    'див https://evil.example/path?x=1 далі',
    'див http://evil.example далі',
    'див www.evil.example далі',
    'див t.me/evil далі',
    'див tg://resolve?domain=evil далі',
  ])('removes the bare link in «%s»', (text) => {
    expect(stripLinks(text)).toBe('див далі');
  });

  it('leaves a plain answer alone', () => {
    expect(stripLinks('Усе гаразд, черги порожні.')).toBe('Усе гаразд, черги порожні.');
  });
});

describe('clip', () => {
  it('leaves short text alone and shortens long text with an ellipsis', () => {
    expect(clip('abc', 5)).toBe('abc');
    expect(clip('abcdefgh', 5)).toBe('abcd…');
  });
});
