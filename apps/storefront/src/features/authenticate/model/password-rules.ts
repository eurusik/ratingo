export const PASSWORD_RULES = ['length', 'case', 'digit'] as const;

export type PasswordRule = (typeof PASSWORD_RULES)[number];

const MIN_PASSWORD_LENGTH = 8;

const RULE_CHECKS: Record<PasswordRule, (password: string) => boolean> = {
  length: (password) => password.length >= MIN_PASSWORD_LENGTH,
  case: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
  digit: (password) => /\d/.test(password),
};

export function checkPasswordRules(password: string): Record<PasswordRule, boolean> {
  return {
    length: RULE_CHECKS.length(password),
    case: RULE_CHECKS.case(password),
    digit: RULE_CHECKS.digit(password),
  };
}

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => RULE_CHECKS[rule](password));
}
