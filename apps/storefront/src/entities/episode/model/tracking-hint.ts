export type TrackingState = 'guest' | 'start' | 'watching' | 'watching-next';

type RememberedState = Exclude<TrackingState, 'guest'>;

type RememberedShow = readonly [slug: string, state: RememberedState];

export interface TrackingHints {
  shows: readonly RememberedShow[];
}

export const TRACKING_HINT_COOKIE = 'ratingo_tracking';

const VERSION = 'v1';
const ENTRY_SEPARATOR = '/';
const STATE_SEPARATOR = '=';
const MAX_REMEMBERED_SHOWS = 15;

const CODE_BY_STATE: Record<RememberedState, string> = {
  start: 's',
  watching: 'w',
  'watching-next': 'n',
};

const STATE_BY_CODE = new Map(
  Object.entries(CODE_BY_STATE).map(([state, code]) => [code, state as RememberedState]),
);

const SAFE_SLUG = /^[A-Za-z0-9_.~-]+$/;

export function isRememberableSlug(slug: string): boolean {
  return SAFE_SLUG.test(slug);
}

export function parseTrackingHints(raw: string | undefined | null): TrackingHints | null {
  if (!raw) return null;
  const [version, ...entries] = raw.split(ENTRY_SEPARATOR);
  if (version !== VERSION) return null;
  const shows: RememberedShow[] = [];
  for (const entry of entries) {
    const [slug, code] = entry.split(STATE_SEPARATOR);
    const state = code === undefined ? undefined : STATE_BY_CODE.get(code);
    const isKnown = shows.some(([known]) => known === slug);
    if (
      slug &&
      isRememberableSlug(slug) &&
      state &&
      !isKnown &&
      shows.length < MAX_REMEMBERED_SHOWS
    ) {
      shows.push([slug, state]);
    }
  }
  return { shows };
}

export function serializeTrackingHints(hints: TrackingHints): string {
  const entries = hints.shows
    .slice(0, MAX_REMEMBERED_SHOWS)
    .map(([slug, state]) => `${slug}${STATE_SEPARATOR}${CODE_BY_STATE[state]}`);
  return [VERSION, ...entries].join(ENTRY_SEPARATOR);
}

export function withTrackingState(
  hints: TrackingHints | null,
  slug: string,
  state: RememberedState,
): TrackingHints {
  const others = (hints?.shows ?? []).filter(([known]) => known !== slug);
  return { shows: [[slug, state] as const, ...others].slice(0, MAX_REMEMBERED_SHOWS) };
}

export function trackingStateFor(hints: TrackingHints | null, slug: string): TrackingState {
  if (!hints) return 'guest';
  return hints.shows.find(([known]) => known === slug)?.[1] ?? 'start';
}

export function signedInTrackingState(state: TrackingState | undefined): RememberedState {
  return state === undefined || state === 'guest' ? 'start' : state;
}

export function trackingStateOf(watchedCount: number, hasUpcoming: boolean): RememberedState {
  if (watchedCount === 0) return 'start';
  return hasUpcoming ? 'watching-next' : 'watching';
}
