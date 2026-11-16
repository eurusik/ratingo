'use client';

import { Button } from '@heroui/react';
import { Pause, X } from 'lucide-react';
import { episodeCode, formatAirDate } from '@/entities/episode';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { SwipeableRow } from '@/shared/ui/gestures';
import { daysFromToday } from '../model/episode-days';
import type { LibraryActions } from '../model/library-actions';
import type { LibraryTitle } from '../model/library-title';
import {
  remainingEpisodes,
  type FreshRow,
  type NextEpisode,
  type NextRow,
  type WaitingRow,
} from '../model/watching-sections';
import { CheckButton } from './check-button';
import { LibraryRow } from './library-row';
import { RowMenu } from './row-menu';

function codeOf(episode: NextEpisode, dict: Dictionary): string {
  return episodeCode({ seasonNumber: episode.seasonNumber, number: episode.episodeNumber }, dict);
}

function relativeDay(airDate: string | undefined, now: number, locale: string): string {
  if (!airDate) return '';
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    daysFromToday(airDate, now),
    'day',
  );
}

function SwipeActions({ title, actions }: { title: LibraryTitle; actions: LibraryActions }) {
  const { dict } = useTranslation();

  return (
    <>
      <Button
        excludeFromTabOrder
        variant="secondary"
        className="h-full min-h-tap flex-col gap-1 rounded-none px-5 text-xs"
        onPress={() => actions.pause(title)}
      >
        <Pause aria-hidden className="size-5" />
        {dict.my.actions.pause}
      </Button>
      <Button
        excludeFromTabOrder
        variant="danger"
        className="h-full min-h-tap flex-col gap-1 rounded-none px-5 text-xs"
        onPress={() => actions.drop(title)}
      >
        <X aria-hidden className="size-5" />
        {dict.my.actions.drop}
      </Button>
    </>
  );
}

function WatchingMenu({ title, actions }: { title: LibraryTitle; actions: LibraryActions }) {
  const { dict } = useTranslation();

  return (
    <RowMenu
      label={interpolate(dict.my.actions.more, { title: title.title })}
      items={[
        { id: 'pause', label: dict.my.actions.pause, onAction: () => actions.pause(title) },
        {
          id: 'drop',
          label: dict.my.actions.drop,
          onAction: () => actions.drop(title),
          isDanger: true,
        },
      ]}
    />
  );
}

interface RowProps<T> {
  row: T;
  actions: LibraryActions;
  now: number;
}

export function FreshEpisodeRow({ row, actions, now }: RowProps<FreshRow>) {
  const { dict, locale } = useTranslation();
  const code = codeOf(row.episode, dict);

  return (
    <SwipeableRow actions={<SwipeActions title={row.title} actions={actions} />}>
      <LibraryRow
        title={row.title}
        event="NEW_EPISODE"
        code={code}
        meta={interpolate(dict.my.watching.newEpisode, {
          code,
          when: relativeDay(row.episode.airDate, now, locale),
        })}
        action={
          <CheckButton
            label={interpolate(dict.my.actions.markEpisode, { title: row.title.title, code })}
            onCheck={() =>
              actions.markEpisodeWatched({
                title: row.title,
                episodeId: row.episode.episodeId,
                code,
              })
            }
          />
        }
        menu={<WatchingMenu title={row.title} actions={actions} />}
      />
    </SwipeableRow>
  );
}

export function NextEpisodeRow({ row, actions }: Omit<RowProps<NextRow>, 'now'>) {
  const { dict } = useTranslation();
  const episode = row.episode;
  const code = episode ? codeOf(episode, dict) : undefined;
  const episodeId = episode?.episodeId;

  return (
    <SwipeableRow actions={<SwipeActions title={row.title} actions={actions} />}>
      <LibraryRow
        title={row.title}
        code={code}
        meta={
          code
            ? interpolate(dict.my.watching.nextEpisode, { code, count: remainingEpisodes(row) })
            : dict.my.watching.caughtUp
        }
        progress={{
          value: Math.min(row.watched, row.total),
          max: row.total,
          label: interpolate(dict.my.watching.progressLabel, {
            watched: row.watched,
            total: row.total,
          }),
        }}
        action={
          episodeId && code ? (
            <CheckButton
              label={interpolate(dict.my.actions.markEpisode, { title: row.title.title, code })}
              onCheck={() => actions.markEpisodeWatched({ title: row.title, episodeId, code })}
            />
          ) : null
        }
        menu={<WatchingMenu title={row.title} actions={actions} />}
      />
    </SwipeableRow>
  );
}

export function WaitingRowItem({ row, actions, now }: RowProps<WaitingRow>) {
  const { dict, locale } = useTranslation();
  const airDate = row.episode?.airDate;
  const isUpcoming = airDate !== undefined && Date.parse(airDate) > now;
  const date = isUpcoming ? formatAirDate(locale, airDate) : undefined;

  return (
    <SwipeableRow actions={<SwipeActions title={row.title} actions={actions} />}>
      <LibraryRow
        title={row.title}
        meta={date ? interpolate(dict.my.watching.airsOn, { date }) : dict.my.watching.caughtUp}
        menu={<WatchingMenu title={row.title} actions={actions} />}
      />
    </SwipeableRow>
  );
}
