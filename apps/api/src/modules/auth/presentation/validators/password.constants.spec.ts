import { PASSWORD_REGEX } from './password.constants';

describe('PASSWORD_REGEX', () => {
  it('should accept valid passwords', () => {
    const validPasswords = ['Password1', 'Abcdefg1', 'Test1234', 'MyP@ss1word'];

    for (const pw of validPasswords) {
      expect(PASSWORD_REGEX.test(pw)).toBe(true);
    }
  });

  it('should reject passwords without uppercase', () => {
    const invalid = ['password1', 'abcdefg1'];

    for (const pw of invalid) {
      expect(PASSWORD_REGEX.test(pw)).toBe(false);
    }
  });

  it('should reject passwords without lowercase', () => {
    const invalid = ['PASSWORD1', 'ABCDEFG1'];

    for (const pw of invalid) {
      expect(PASSWORD_REGEX.test(pw)).toBe(false);
    }
  });

  it('should reject passwords without digit', () => {
    const invalid = ['Passwordd', 'Abcdefgh'];

    for (const pw of invalid) {
      expect(PASSWORD_REGEX.test(pw)).toBe(false);
    }
  });

  it('should reject passwords shorter than 8 chars', () => {
    const invalid = ['Pass1', 'Ab1'];

    for (const pw of invalid) {
      expect(PASSWORD_REGEX.test(pw)).toBe(false);
    }
  });

  it('should accept passwords exactly 8 chars', () => {
    expect(PASSWORD_REGEX.test('Passwor1')).toBe(true);
  });
});
