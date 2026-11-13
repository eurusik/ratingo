import fc from 'fast-check';
import { findUsernameProblem, suggestUsername } from './username';

describe('suggestUsername', () => {
  it.each([
    ['ivan_42@example.com', 'ivan_42'],
    ['ivan.petrenko+films@example.com', 'ivan_petrenko_films'],
    ['іван@example.com', 'ratingo_fan'],
    ['', 'ratingo_fan'],
  ])('turns %s into %s', (email, username) => {
    expect(suggestUsername(email)).toBe(username);
  });

  it('always suggests a name the API accepts', () => {
    fc.assert(
      fc.property(fc.string(), (email) => {
        expect(findUsernameProblem(suggestUsername(email))).toBeNull();
      }),
    );
  });
});

describe('findUsernameProblem', () => {
  it.each([
    ['ab', 'length'],
    ['a'.repeat(30), null],
    ['a'.repeat(31), 'length'],
    ['іван_42', 'format'],
    ['ivan 42', 'format'],
    ['ivan_42', null],
  ])('reports %s as %p', (username, problem) => {
    expect(findUsernameProblem(username)).toBe(problem);
  });
});
