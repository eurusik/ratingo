const SUBSTRING_PATTERNS = [
  'email',
  'password',
  'passwd',
  'token',
  'secret',
  'hash',
  'session',
  'cookie',
  'phone',
  'oauth',
  'credential',
  'bearer',
  'address',
  'endpoint',
  'fingerprint',
  'user_agent',
  'username',
  'first_name',
  'last_name',
  'full_name',
  'birth',
  'apikey',
  'api_key',
  'message',
  'comment',
  'note',
  'body',
  'nickname',
  'contact',
  'telegram',
  'chat_id',
  'remote_addr',
  'nonce',
  'signature',
] as const;

const WORD_PATTERNS = [
  'ip',
  'key',
  'auth',
  'push',
  'device',
  'salt',
  'jwt',
  'ssn',
  'otp',
  'dob',
  'lat',
  'lng',
] as const;

export const sensitivePatternIn = (name: string): string | null => {
  const lowered = name.toLowerCase();
  const substring = SUBSTRING_PATTERNS.find((pattern) => lowered.includes(pattern));
  if (substring !== undefined) return substring;
  const words = lowered.split('_');
  return WORD_PATTERNS.find((pattern) => words.includes(pattern)) ?? null;
};
