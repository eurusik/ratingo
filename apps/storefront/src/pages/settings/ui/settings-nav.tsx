'use client';

import { Button, Separator } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { cn } from '@ratingo/web-core/lib';
import { useTranslation } from '@/shared/i18n';
import { PAGE_TITLE, SideNavItem } from '@/shared/ui';
import {
  SECTION_ROUTES,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from '../model/settings-sections';

export function SettingsNav({ current }: { current: SettingsSection }) {
  const { dict } = useTranslation();
  const { logout } = useAuth();

  return (
    <nav aria-label={dict.settings.sectionsLabel} className="flex w-55 shrink-0 flex-col gap-1">
      <p className={cn('mb-3 flex min-h-11 items-center', PAGE_TITLE, 'md:text-[32px]')}>
        {dict.settings.title}
      </p>
      {SETTINGS_SECTIONS.map((section) => (
        <SideNavItem
          key={section}
          href={SECTION_ROUTES[section]}
          label={dict.settings.sections[section]}
          isCurrent={current === section}
        />
      ))}
      <Separator className="my-2" />
      <Button
        variant="ghost"
        className="h-10 justify-start rounded-xl px-3.5 text-sm font-semibold text-danger"
        onPress={() => void logout()}
      >
        {dict.settings.signOut}
      </Button>
    </nav>
  );
}
