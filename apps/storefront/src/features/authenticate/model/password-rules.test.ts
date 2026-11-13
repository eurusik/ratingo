import fc from 'fast-check';
import { checkPasswordRules, isStrongPassword } from './password-rules';

const API_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

describe('password rules', () => {
  it('reports each rule separately', () => {
    expect(checkPasswordRules('Abcdefgh')).toEqual({ length: true, case: true, digit: false });
    expect(checkPasswordRules('abc1')).toEqual({ length: false, case: false, digit: true });
  });

  it('accepts exactly the passwords the API accepts', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 16 }), (password) => {
        expect(isStrongPassword(password)).toBe(API_PASSWORD_PATTERN.test(password));
      }),
    );
  });
});
