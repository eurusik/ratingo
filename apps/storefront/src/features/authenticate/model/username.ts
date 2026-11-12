const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const DISALLOWED_CHARACTERS = /[^a-zA-Z0-9_]+/g;
const EDGE_UNDERSCORES = /^_+|_+$/g;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;
const FALLBACK_USERNAME = 'ratingo_fan';

export type UsernameProblem = 'length' | 'format';

export function findUsernameProblem(username: string): UsernameProblem | null {
  if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH)
    return 'length';
  return USERNAME_PATTERN.test(username) ? null : 'format';
}

export function suggestUsername(email: string): string {
  const [localPart = ''] = email.split('@');
  const candidate = localPart
    .replace(DISALLOWED_CHARACTERS, '_')
    .slice(0, MAX_USERNAME_LENGTH)
    .replace(EDGE_UNDERSCORES, '');
  return candidate.length >= MIN_USERNAME_LENGTH ? candidate : FALLBACK_USERNAME;
}
