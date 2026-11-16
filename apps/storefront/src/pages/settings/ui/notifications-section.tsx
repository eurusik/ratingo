'use client';

import { useState } from 'react';
import { Button, Skeleton } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useRevealedRows } from '@/shared/lib';
import { EMPTY_STATE_ACTION, EmptyState, LIST_ROW_FRAME, ListSearch, ShowMore } from '@/shared/ui';
import { useAccountToggles } from '../model/account-toggles';
import { useFollowedSummary, useFollowedTitles, useUnfollowTitle } from '../model/followed-queries';
import { matchingFollowedTitles } from '../model/followed-titles';
import { cn } from '@ratingo/web-core/lib';
import { CARD_LIST, SettingsGroup } from './settings-card';
import { FollowedRow } from './followed-row';
import { SettingSwitch } from './setting-switch';

const SKELETON_ROWS = 5;

const FOLLOWED_LIST = cn(CARD_LIST, 'md:rounded-none md:bg-transparent md:px-0');

function FollowedSkeleton() {
  const { dict } = useTranslation();

  return (
    <div role="status" aria-busy className={FOLLOWED_LIST}>
      <span className="sr-only">{dict.common.loading}</span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div
          key={index}
          className="flex min-h-[79px] items-center gap-3 py-2 md:min-h-[97px] md:gap-4"
        >
          <Skeleton className={cn('shrink-0 rounded-[10px]', LIST_ROW_FRAME)} />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5 rounded-md" />
            <Skeleton className="h-3.5 w-2/5 rounded-md" />
          </span>
        </div>
      ))}
    </div>
  );
}

function FollowedTitles() {
  const { dict } = useTranslation();
  const copy = dict.settings.notifications;
  const followed = useFollowedTitles();
  const unfollow = useUnfollowTitle();
  const [query, setQuery] = useState('');
  const matching = matchingFollowedTitles(followed.data ?? [], query);
  const reveal = useRevealedRows(matching, query);

  if (followed.isPending) return <FollowedSkeleton />;
  if (!followed.data) {
    return (
      <EmptyState
        title={copy.failed}
        text={dict.notifications.failedText}
        action={
          <Button
            variant="secondary"
            className={EMPTY_STATE_ACTION}
            onPress={() => void followed.refetch()}
          >
            {copy.retry}
          </Button>
        }
      />
    );
  }

  const titles = followed.data;
  if (titles.length === 0) return <EmptyState title={copy.empty.title} text={copy.empty.text} />;

  return (
    <>
      <ListSearch
        label={copy.searchLabel}
        placeholder={copy.searchPlaceholder}
        value={query}
        onChange={setQuery}
      />
      {matching.length === 0 ? (
        <p className="mx-1 my-2 text-[15px] text-muted">
          {interpolate(copy.noMatch, { query: query.trim() })}
        </p>
      ) : (
        <ul className={FOLLOWED_LIST}>
          {reveal.shown.map((title) => (
            <li key={title.mediaItemId}>
              <FollowedRow
                title={title}
                onUnfollow={() =>
                  unfollow({ title, index: titles.findIndex((known) => known === title) })
                }
              />
            </li>
          ))}
        </ul>
      )}
      <ShowMore
        key={query}
        hasMore={reveal.hasMore}
        label={copy.showMore}
        loadingLabel={dict.common.loading}
        rearmKey={reveal.shownCount}
        onMore={reveal.showMore}
      />
    </>
  );
}

export function NotificationsSection() {
  const { dict } = useTranslation();
  const copy = dict.settings.notifications;
  const toggles = useAccountToggles();
  const summary = useFollowedSummary();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-snug text-muted md:text-[15px]">{copy.lead}</p>
      <SettingsGroup
        titleId="settings-following"
        title={summary ? `${copy.following} · ${summary}` : copy.following}
      >
        <FollowedTitles />
      </SettingsGroup>
      <SettingsGroup titleId="settings-automatic" title={copy.automatic}>
        <ul className={CARD_LIST}>
          <li>
            <SettingSwitch
              label={copy.autoSubscribe}
              hint={copy.autoSubscribeHint}
              isSelected={toggles.isOn('autoSubscribeOnWatch')}
              onChange={(value) => toggles.set('autoSubscribeOnWatch', value)}
            />
          </li>
        </ul>
      </SettingsGroup>
    </div>
  );
}
