import type { Finding } from '../entities/finding';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SECOND_HASH_SALT = 0x9e3779b9;
const HEX_WIDTH = 8;
const FINGERPRINT_MESSAGE_CHARS = 160;

const hash32 = (text: string, seed: number): number => {
  let hash = (FNV_OFFSET ^ seed) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return hash;
};

const hex = (value: number): string => value.toString(16).padStart(HEX_WIDTH, '0');

const normalizeMessage = (message: string): string =>
  message.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, FINGERPRINT_MESSAGE_CHARS);

export const fingerprintFinding = (
  finding: Pick<Finding, 'file' | 'category' | 'message'>,
): string => {
  const key = `${finding.file}\u0000${finding.category}\u0000${normalizeMessage(finding.message)}`;
  return `${hex(hash32(key, 0))}${hex(hash32(key, SECOND_HASH_SALT))}`;
};
