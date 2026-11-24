import { fromHomeItem, type TrendingMedia } from '@/entities/media';
import type {
  AnticipatedShow,
  HomeItem,
  NewEpisode,
  ReleaseKind,
  UpcomingMovie,
} from '@/shared/api';
import { tmdbPosterUrl } from '@/shared/config';

export const TOP_TEN_COUNT = 10;

export const UPCOMING_COUNT = 10;

export const PREMIERES_COUNT = 20;

const MIN_PREMIERES_TO_SHOW = 5;

const TOP_THREE_COUNT = 3;

export type Loaded<T> = { ok: true; data: T } | { ok: false };

export function anySectionLoads(
  sections: ReadonlyArray<Promise<Loaded<unknown>>>,
): Promise<boolean> {
  if (sections.length === 0) return Promise.resolve(false);

  return new Promise((resolve) => {
    let unsettled = sections.length;
    sections.forEach(
      (section) =>
        void section.then((loaded) => {
          unsettled -= 1;
          if (loaded.ok) resolve(true);
          else if (unsettled === 0) resolve(false);
        }),
    );
  });
}

export interface HeroMedia extends TrendingMedia {
  overview?: string;
  wideBackdropUrl?: string;
}

export interface HomeHero {
  lead?: HeroMedia;
  picks: TrendingMedia[];
  firstPickRank: number;
}

export interface EpisodeRelease {
  mediaItemId: string;
  slug: string;
  showTitle: string;
  episodeTitle: string;
  posterUrl?: string;
  season: number;
  episode: number;
  airedAt: string;
}

const API_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/;

function toHeroMedia(item: HomeItem): HeroMedia {
  return {
    ...fromHomeItem(item),
    backdropUrl: item.backdrop.medium,
    wideBackdropUrl: item.backdrop.large,
    overview: item.overview ?? undefined,
  };
}

export function buildHomeHero(items: readonly HomeItem[]): HomeHero {
  const [lead, ...rest] = items;
  return {
    lead: lead ? toHeroMedia(lead) : undefined,
    picks: rest.slice(0, TOP_THREE_COUNT).map(fromHomeItem),
    firstPickRank: lead ? 2 : 1,
  };
}

const VERDICT_ORDER = ['good', 'mixed', undefined, 'bad'] as const;

function verdictRank(media: TrendingMedia): number {
  return VERDICT_ORDER.indexOf(media.verdict);
}

function unratedRank(media: TrendingMedia): number {
  return Number(media.imdbRating === undefined && media.criticsPercent === undefined);
}

export function toReleaseRail(items: readonly TrendingMedia[]): TrendingMedia[] {
  return [...items]
    .sort((a, b) => verdictRank(a) - verdictRank(b) || unratedRank(a) - unratedRank(b))
    .map((media) => ({ ...media, event: undefined }));
}

function toIsoOffset(zone: string | undefined): string {
  if (!zone || zone === 'Z') return 'Z';
  const digits = zone.slice(1).replace(':', '');
  return `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2) || '00'}`;
}

export function toAiredAt(airDate: string): string {
  const match = API_DATE_TIME.exec(airDate);
  if (!match) return airDate;
  const [, date, time, zone] = match;
  return `${date}T${time}${toIsoOffset(zone)}`;
}

export function toEpisodeRelease(item: NewEpisode): EpisodeRelease {
  return {
    mediaItemId: item.mediaItemId,
    slug: item.slug,
    showTitle: item.title,
    episodeTitle: item.episodeTitle,
    posterUrl: tmdbPosterUrl(item.posterPath, 'w342'),
    season: item.seasonNumber,
    episode: item.episodeNumber,
    airedAt: toAiredAt(item.airDate),
  };
}

export interface UpcomingRelease {
  mediaItemId: string;
  slug: string;
  title: string;
  posterUrl?: string;
  releaseDate: string;
  kind: ReleaseKind;
}

export function toUpcomingRelease(movie: UpcomingMovie): UpcomingRelease {
  return {
    mediaItemId: movie.mediaItemId,
    slug: movie.slug,
    title: movie.title,
    posterUrl: movie.poster?.small,
    releaseDate: movie.effectiveReleaseDate,
    kind: movie.releaseDateKind,
  };
}

type PremiereKind = 'newShow';

export interface PremiereRelease {
  mediaItemId: string;
  slug: string;
  title: string;
  posterUrl: string;
  premiereDate: string;
  kind: PremiereKind;
}

export function toPremiereRail(shows: readonly AnticipatedShow[]): PremiereRelease[] {
  if (shows.length < MIN_PREMIERES_TO_SHOW) return [];
  return shows.map((show) => ({
    mediaItemId: show.mediaItemId,
    slug: show.slug,
    title: show.title,
    posterUrl: show.poster.small,
    premiereDate: show.premiereDate,
    kind: 'newShow',
  }));
}
