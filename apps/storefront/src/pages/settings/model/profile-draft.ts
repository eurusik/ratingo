import type { MeDto } from '@ratingo/web-core/auth';
import type { ProfileChanges } from '@/shared/api';

export const BIO_MAX_LENGTH = 200;
export const LOCATION_MAX_LENGTH = 100;
export const DEFAULT_REGION = 'UA';

export interface ProfileDraft {
  username: string;
  region: string;
  bio: string;
  location: string;
  website: string;
}

const URL_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
const HTTPS_PREFIX = /^https:\/\//i;
const WEB_PROTOCOLS = new Set(['http:', 'https:']);

export function normalizeWebsite(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  return URL_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isWebsite(input: string): boolean {
  const normalized = normalizeWebsite(input);
  if (normalized === '') return true;
  try {
    const url = new URL(normalized);
    return WEB_PROTOCOLS.has(url.protocol) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

export function draftOf(user: MeDto): ProfileDraft {
  return {
    username: user.username,
    region: user.profile.preferredRegion ?? DEFAULT_REGION,
    bio: user.profile.bio ?? '',
    location: user.profile.location ?? '',
    website: (user.profile.website ?? '').replace(HTTPS_PREFIX, ''),
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

type ProfileFields = Pick<
  ProfileChanges,
  'username' | 'preferredRegion' | 'bio' | 'location' | 'website'
>;

const PROFILE_FIELDS: readonly (keyof ProfileFields)[] = [
  'username',
  'preferredRegion',
  'bio',
  'location',
  'website',
];

function savedFields(draft: ProfileDraft): ProfileFields {
  return {
    username: draft.username.trim(),
    preferredRegion: draft.region,
    bio: optionalText(draft.bio),
    location: optionalText(draft.location),
    website: optionalText(normalizeWebsite(draft.website)),
  };
}

export function changesOf(saved: ProfileDraft, draft: ProfileDraft): ProfileChanges {
  const before = savedFields(saved);
  const after = savedFields(draft);
  return Object.fromEntries(
    PROFILE_FIELDS.filter((field) => before[field] !== after[field]).map((field) => [
      field,
      after[field],
    ]),
  );
}

export function hasChanges(saved: ProfileDraft, draft: ProfileDraft): boolean {
  return Object.keys(changesOf(saved, draft)).length > 0;
}
