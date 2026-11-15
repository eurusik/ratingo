'use client';

import { useId } from 'react';
import { Button } from '@heroui/react';
import { pluralize } from '@ratingo/web-core/lib';
import type { CalendarEpisode } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useRememberedFlag } from '../lib/remembered-flag';
import { planDay } from '../model/day-plan';
import type { CalendarDay } from '../model/week-layout';
import { useCalendarContext } from './calendar-context';
import { CalendarEpisodeItem } from './calendar-episode';
import { EPISODE_LIST } from './calendar-layout';

function EpisodeList({ id, episodes }: { id?: string; episodes: readonly CalendarEpisode[] }) {
  return (
    <ul id={id} className={EPISODE_LIST}>
      {episodes.map((episode) => (
        <CalendarEpisodeItem key={episode.episodeId} episode={episode} />
      ))}
    </ul>
  );
}

export function DayEpisodes({ day }: { day: CalendarDay }) {
  const { dict, locale } = useTranslation();
  const { mode } = useCalendarContext();
  const [isExpanded, setExpanded] = useRememberedFlag(`${mode}:${day.key}:more-shows`);
  const hiddenListId = useId();
  const plan = planDay(day.episodes, mode);
  const hiddenShowCount = plan.hiddenShows;

  return (
    <div className="min-w-0">
      <EpisodeList episodes={plan.visible} />
      {hiddenShowCount > 0 ? (
        <>
          <EpisodeList id={hiddenListId} episodes={isExpanded ? plan.hidden : []} />
          <Button
            variant="ghost"
            aria-expanded={isExpanded}
            aria-controls={hiddenListId}
            onPress={() => setExpanded(!isExpanded)}
            className="mt-1.5 min-h-tap px-0 text-sm font-semibold text-accent md:mt-3"
          >
            {isExpanded
              ? dict.calendar.lessShows
              : interpolate(pluralize(hiddenShowCount, dict.calendar.moreShows, locale), {
                  count: hiddenShowCount,
                })}
          </Button>
        </>
      ) : null}
    </div>
  );
}
