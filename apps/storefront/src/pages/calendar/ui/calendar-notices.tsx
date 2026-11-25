'use client';

import type { ReactNode } from 'react';
import { Button, Card } from '@heroui/react';
import { openAuth } from '@/shared/auth';
import type { CalendarEpisode, CalendarMediaType } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { SectionError } from '@/shared/ui';
import { kyivDateKey, type DateKey } from '../model/calendar-dates';
import { formatDay } from '../model/calendar-format';
import { calendarEpisodeCode } from '../model/episode-line';
import { DASHED_NOTE, PROMPT_BUTTON, PROMPT_CARD } from './calendar-layout';

interface PromptProps {
  title: string;
  body: string;
  actions: ReactNode;
}

function PromptCard({ title, body, actions }: PromptProps) {
  return (
    <Card className={PROMPT_CARD}>
      <Card.Header className="gap-1.5 p-0">
        <Card.Title className="text-[17px] font-extrabold">{title}</Card.Title>
        <Card.Description className="text-sm leading-relaxed">{body}</Card.Description>
      </Card.Header>
      <Card.Footer className="flex gap-2 p-0">{actions}</Card.Footer>
    </Card>
  );
}

interface TypedPromptProps {
  type: CalendarMediaType;
  onShowAll: () => void;
}

export function GuestPrompt({ type, onShowAll }: TypedPromptProps) {
  const { dict } = useTranslation();
  const copy = dict.calendar.guest;

  return (
    <PromptCard
      title={copy[type].title}
      body={copy[type].body}
      actions={
        <>
          <Button className={PROMPT_BUTTON} onPress={() => openAuth({ mode: 'login' })}>
            {copy.signIn}
          </Button>
          <Button variant="secondary" className={PROMPT_BUTTON} onPress={onShowAll}>
            {copy.showAll}
          </Button>
        </>
      }
    />
  );
}

export function NoOwnReleasesPrompt({ type, onShowAll }: TypedPromptProps) {
  const { dict } = useTranslation();
  const copy = dict.calendar.noOwnReleases;

  return (
    <PromptCard
      title={copy[type].title}
      body={copy[type].body}
      actions={
        <Button variant="secondary" className={PROMPT_BUTTON} onPress={onShowAll}>
          {copy.showAll}
        </Button>
      }
    />
  );
}

interface RestWeekProps {
  upcoming?: CalendarEpisode;
  onNextWeek: () => void;
}

export function RestWeekNote({ upcoming, onNextWeek }: RestWeekProps) {
  const { dict, locale } = useTranslation();
  const copy = dict.calendar.restWeek;

  return (
    <div className={DASHED_NOTE}>
      <p className="text-base font-bold">{copy.title}</p>
      {upcoming ? (
        <p className="text-sm text-muted">
          {interpolate(copy.next, {
            episode: `${upcoming.showTitle}\u00a0${calendarEpisodeCode(upcoming, dict)}`,
            date: formatDay(locale, kyivDateKey(upcoming.airDate), 'dayMonth'),
          })}
        </p>
      ) : null}
      <Button variant="outline" onPress={onNextWeek} className="mt-1 h-11 rounded-full px-4">
        {copy.nextWeek}
      </Button>
    </div>
  );
}

interface PremiereFreeWeekProps {
  upcoming?: CalendarEpisode;
  onJump: (day: DateKey) => void;
}

export function PremiereFreeWeekNote({ upcoming, onJump }: PremiereFreeWeekProps) {
  const { dict, locale } = useTranslation();
  const copy = dict.calendar.noPremieres;
  const premiereDay = upcoming && kyivDateKey(upcoming.airDate);

  return (
    <div className={DASHED_NOTE}>
      <p className="text-base font-bold">{copy.title}</p>
      {upcoming && premiereDay ? (
        <>
          <p className="text-sm text-muted">
            {interpolate(copy.next, {
              title: upcoming.showTitle,
              date: formatDay(locale, premiereDay, 'dayMonth'),
            })}
          </p>
          <Button
            variant="outline"
            onPress={() => onJump(premiereDay)}
            className="mt-1 h-11 rounded-full px-4"
          >
            {copy.jump}
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function EmptyWeekNote({ type }: { type: CalendarMediaType }) {
  const { dict } = useTranslation();

  return (
    <div className={DASHED_NOTE}>
      <p className="text-base font-bold">{dict.calendar.emptyWeek[type]}</p>
    </div>
  );
}

interface CalendarErrorProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function CalendarError({ onRetry, isRetrying }: CalendarErrorProps) {
  const { dict } = useTranslation();

  return (
    <SectionError
      title={dict.calendar.loadError}
      onRetry={onRetry}
      isRetrying={isRetrying}
      className="min-h-80 w-full"
    />
  );
}
