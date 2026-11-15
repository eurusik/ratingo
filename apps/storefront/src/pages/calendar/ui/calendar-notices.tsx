'use client';

import type { ReactNode } from 'react';
import { Button, Card } from '@heroui/react';
import { openAuth } from '@/shared/auth';
import type { CalendarEpisode } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { kyivDateKey } from '../model/calendar-dates';
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

export function GuestPrompt({ onShowAll }: { onShowAll: () => void }) {
  const { dict } = useTranslation();
  const copy = dict.calendar.guest;

  return (
    <PromptCard
      title={copy.title}
      body={copy.body}
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

export function NoShowsPrompt({ onShowAll }: { onShowAll: () => void }) {
  const { dict } = useTranslation();
  const copy = dict.calendar.noShows;

  return (
    <PromptCard
      title={copy.title}
      body={copy.body}
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

export function EmptyWeekNote() {
  const { dict } = useTranslation();

  return (
    <div className={DASHED_NOTE}>
      <p className="text-base font-bold">{dict.calendar.emptyWeek}</p>
    </div>
  );
}

export function CalendarError({ onRetry }: { onRetry: () => void }) {
  const { dict } = useTranslation();

  return (
    <div role="alert" className="flex flex-col items-center gap-3 text-center text-sm">
      <p className="text-muted">{dict.calendar.loadError}</p>
      <Button variant="secondary" onPress={onRetry} className="min-h-tap">
        {dict.calendar.retry}
      </Button>
    </div>
  );
}
