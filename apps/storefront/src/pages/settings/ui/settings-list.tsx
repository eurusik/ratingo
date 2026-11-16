'use client';

import Link from 'next/link';
import { Avatar, Button } from '@heroui/react';
import { ChevronRight, Download, Eye, Lock, User, Bell, type LucideIcon } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import { initialOf } from '@/shared/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useAccount, visibilityOf } from '../model/account';
import { runningProgress } from '../model/import/import-batches';
import { useImportBatches } from '../model/import/import-queries';
import { useFollowedSummary } from '../model/followed-queries';
import { useSignInSummary } from '../model/method-names';
import { SECTION_ROUTES, type SettingsSection } from '../model/settings-sections';
import { CARD_LIST, SettingsGroup } from './settings-card';

const ROW_LINK =
  'flex min-h-13 w-full items-center gap-3.5 text-base text-foreground no-underline outline-none transition-opacity [@media(hover:hover)]:hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

interface ListRow {
  section: SettingsSection;
  icon: LucideIcon;
  tone: string;
  label: string;
  value?: string;
}

function RowLink({ section, icon: Icon, tone, label, value }: ListRow) {
  return (
    <Link href={SECTION_ROUTES[section]} className={ROW_LINK}>
      <span
        aria-hidden
        className={`flex size-7.5 shrink-0 items-center justify-center rounded-lg text-white ${tone}`}
      >
        <Icon className="size-[17px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value ? <span className="max-w-[45%] truncate text-sm text-muted">{value}</span> : null}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

function AccountCard() {
  const { dict } = useTranslation();
  const user = useAccount();
  const visibility = visibilityOf(user);

  return (
    <Link
      href={SECTION_ROUTES.profile}
      className="flex items-center gap-3.5 rounded-[20px] bg-surface p-4 text-foreground no-underline outline-none transition-colors [@media(hover:hover)]:hover:bg-default focus-visible:outline-2 focus-visible:outline-focus"
    >
      <Avatar className="size-14 shrink-0 rounded-full text-[22px] font-extrabold">
        {user.avatarUrl ? <Avatar.Image src={user.avatarUrl} alt="" /> : null}
        <Avatar.Fallback>{initialOf(user.username)}</Avatar.Fallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span translate="no" className="truncate font-bold">
          {user.username}
        </span>
        <span className="truncate text-sm text-muted">
          <span translate="no">{user.email}</span> · {dict.settings.profileVisibility[visibility]}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-[18px] shrink-0 text-muted" />
    </Link>
  );
}

function RowGroup({ id, title, rows }: { id: string; title: string; rows: ListRow[] }) {
  return (
    <SettingsGroup titleId={id} title={title}>
      <ul className={CARD_LIST}>
        {rows.map((row) => (
          <li key={row.section}>
            <RowLink {...row} />
          </li>
        ))}
      </ul>
    </SettingsGroup>
  );
}

export function SettingsList() {
  const { dict } = useTranslation();
  const copy = dict.settings;
  const { logout } = useAuth();
  const user = useAccount();
  const followedSummary = useFollowedSummary();
  const signInSummary = useSignInSummary();
  const visibility = visibilityOf(user);
  const importProgress = runningProgress(useImportBatches().data);

  return (
    <div className="flex flex-col gap-5.5">
      <AccountCard />
      <RowGroup
        id="settings-group-account"
        title={copy.groups.account}
        rows={[
          {
            section: 'profile',
            icon: User,
            tone: 'bg-zinc-700',
            label: copy.sections.profile,
            value: `@${user.username}`,
          },
          {
            section: 'security',
            icon: Lock,
            tone: 'bg-zinc-600',
            label: copy.sections.security,
            value: signInSummary,
          },
        ]}
      />
      <RowGroup
        id="settings-group-app"
        title={copy.groups.app}
        rows={[
          {
            section: 'notifications',
            icon: Bell,
            tone: 'bg-accent',
            label: copy.sections.notifications,
            value: followedSummary,
          },
          {
            section: 'privacy',
            icon: Eye,
            tone: 'bg-green-600',
            label: copy.sections.privacy,
            value: copy.visibility[visibility],
          },
        ]}
      />
      <RowGroup
        id="settings-group-data"
        title={copy.groups.data}
        rows={[
          {
            section: 'import',
            icon: Download,
            tone: 'bg-violet-600',
            label: copy.importRow,
            value: importProgress
              ? interpolate(copy.importRunning, {
                done: importProgress.done,
                total: importProgress.total,
              })
              : copy.importValue,
          },
        ]}
      />
      <Button
        variant="danger-soft"
        fullWidth
        className="h-12 rounded-full text-base font-semibold"
        onPress={() => void logout()}
      >
        {copy.signOut}
      </Button>
      <p className="-mt-2.5 text-center text-xs text-muted">{copy.footnote}</p>
    </div>
  );
}
