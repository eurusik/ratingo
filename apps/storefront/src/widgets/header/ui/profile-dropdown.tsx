'use client';

import { useState } from 'react';
import { Dropdown, Header, Label, Separator, type Key, type Selection } from '@heroui/react';
import type { MeDto } from '@ratingo/web-core/auth';
import { ADMIN_URL, SETTINGS_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { COLOR_THEMES, LOCALES, useProfileActions } from '../model/profile-actions';
import { ProfileSummary } from './profile-summary';
import { UserAvatar } from './user-avatar';

const THEME_PREFIX = 'theme:';
const LOCALE_PREFIX = 'locale:';

function pickSelected<T extends string>(
  selection: Selection,
  prefix: string,
  options: readonly T[],
): T | undefined {
  if (selection === 'all') return undefined;
  const [key] = selection;
  return options.find((option) => `${prefix}${option}` === key);
}

export function ProfileDropdown({ user }: { user: MeDto }) {
  const { dict } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const actions = useProfileActions();

  const onAction = (key: Key) => {
    if (key === 'install') actions.installApp?.();
    if (key === 'sign-out') actions.signOut();
  };

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <Dropdown.Trigger
        aria-label={dict.header.profile}
        className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-focus"
      >
        <UserAvatar user={user} />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="w-80">
        <div className="p-3">
          <ProfileSummary user={user} onNavigate={() => setIsOpen(false)} />
        </div>
        <Dropdown.Menu aria-label={dict.header.profile} onAction={onAction}>
          <Dropdown.Section
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[`${THEME_PREFIX}${actions.theme}`]}
            onSelectionChange={(selection) => {
              const theme = pickSelected(selection, THEME_PREFIX, COLOR_THEMES);
              if (theme) actions.setTheme(theme);
            }}
          >
            <Header>{dict.profile.theme}</Header>
            {COLOR_THEMES.map((theme) => (
              <Dropdown.Item
                key={theme}
                id={`${THEME_PREFIX}${theme}`}
                textValue={dict.profile.themes[theme]}
              >
                <Label>{dict.profile.themes[theme]}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Dropdown.Section
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[`${LOCALE_PREFIX}${actions.locale}`]}
            onSelectionChange={(selection) => {
              const locale = pickSelected(selection, LOCALE_PREFIX, LOCALES);
              if (locale) actions.changeLocale(locale);
            }}
          >
            <Header>{dict.profile.language}</Header>
            {LOCALES.map((locale) => (
              <Dropdown.Item
                key={locale}
                id={`${LOCALE_PREFIX}${locale}`}
                textValue={dict.profile.languageNames[locale]}
              >
                <Label lang={locale}>{dict.profile.languageNames[locale]}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Separator />
          <Dropdown.Item id="settings" href={SETTINGS_ROUTE} textValue={dict.profile.settings}>
            <Label>{dict.profile.settings}</Label>
          </Dropdown.Item>
          {actions.installApp ? (
            <Dropdown.Item id="install" textValue={dict.profile.install}>
              <Label>{dict.profile.install}</Label>
            </Dropdown.Item>
          ) : null}
          {actions.isAdmin ? (
            <Dropdown.Item id="admin" href={ADMIN_URL} textValue={dict.profile.admin}>
              <Label>{dict.profile.admin}</Label>
            </Dropdown.Item>
          ) : null}
          <Separator />
          <Dropdown.Item id="sign-out" variant="danger" textValue={dict.profile.signOut}>
            <Label>{dict.profile.signOut}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
