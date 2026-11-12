'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@heroui/react';
import {
  ChevronRight,
  Download,
  Globe,
  LogOut,
  Moon,
  Settings,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import type { MeDto } from '@ratingo/web-core/auth';
import { ADMIN_URL, SETTINGS_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { SegmentedFilter, Sheet } from '@/shared/ui';
import { COLOR_THEMES, LOCALES, useProfileActions } from '../model/profile-actions';
import { ProfileSummary } from './profile-summary';
import { UserAvatar } from './user-avatar';

const ROW_CLASS =
  'flex min-h-13 w-full items-center gap-3.5 text-base text-foreground no-underline focus-visible:outline-2 focus-visible:outline-focus';

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden className="size-5 shrink-0 text-muted" />;
}

function SettingRow({
  icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={ROW_CLASS}>
      <RowIcon icon={icon} />
      <span className="flex-1">{label}</span>
      <div className="[&_[role=group]]:px-0">{children}</div>
    </div>
  );
}

export function ProfileSheet({ user }: { user: MeDto }) {
  const { dict } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const actions = useProfileActions();
  const close = () => setIsOpen(false);

  const trigger = (
    <Button
      isIconOnly
      variant="ghost"
      className="size-11 rounded-full"
      aria-label={dict.header.profile}
    >
      <UserAvatar user={user} />
    </Button>
  );

  return (
    <Sheet trigger={trigger} isOpen={isOpen} onOpenChange={setIsOpen} title={dict.header.profile}>
      <div className="flex flex-col gap-2">
        <ProfileSummary user={user} />
        <ul className="mt-2 flex flex-col divide-y divide-separator">
          <li>
            <SettingRow icon={Moon} label={dict.profile.theme}>
              <SegmentedFilter
                label={dict.profile.theme}
                options={COLOR_THEMES.map((id) => ({ id, label: dict.profile.themes[id] }))}
                value={actions.theme}
                onChange={actions.setTheme}
              />
            </SettingRow>
          </li>
          <li>
            <SettingRow icon={Globe} label={dict.profile.language}>
              <SegmentedFilter
                label={dict.profile.language}
                options={LOCALES.map((id) => ({ id, label: dict.profile.languageNames[id] }))}
                value={actions.locale}
                onChange={actions.changeLocale}
              />
            </SettingRow>
          </li>
          <li>
            <Link href={SETTINGS_ROUTE} onClick={close} className={ROW_CLASS}>
              <RowIcon icon={Settings} />
              <span className="flex-1">{dict.profile.settings}</span>
              <ChevronRight aria-hidden className="size-[18px] text-muted" />
            </Link>
          </li>
          {actions.installApp ? (
            <li>
              <Button
                variant="ghost"
                fullWidth
                onPress={actions.installApp}
                className={`${ROW_CLASS} h-auto justify-start rounded-none px-0 font-normal`}
              >
                <RowIcon icon={Download} />
                <span className="flex-1 text-start">{dict.profile.install}</span>
                <span className="text-sm text-muted">{dict.profile.installHint}</span>
              </Button>
            </li>
          ) : null}
          {actions.isAdmin ? (
            <li>
              <a href={ADMIN_URL} className={ROW_CLASS}>
                <RowIcon icon={Shield} />
                <span className="flex-1">{dict.profile.admin}</span>
                <ChevronRight aria-hidden className="size-[18px] text-muted" />
              </a>
            </li>
          ) : null}
        </ul>
        <Button
          variant="danger-soft"
          size="lg"
          fullWidth
          className="mt-4"
          onPress={actions.signOut}
        >
          <LogOut aria-hidden className="size-[18px]" />
          {dict.profile.signOut}
        </Button>
      </div>
    </Sheet>
  );
}
