'use client';

import { useAuth } from '@ratingo/web-core/auth';
import { useColorTheme, type ColorTheme } from '@ratingo/ui/theme';
import { useChangeLocale, useTranslation, type Locale } from '@/shared/i18n';
import { useInstallApp } from '@/shared/lib';

export const COLOR_THEMES: readonly ColorTheme[] = ['dark', 'light'];
export const LOCALES: readonly Locale[] = ['uk', 'en'];

export function useProfileActions() {
  const { logout, isAdmin } = useAuth();
  const { theme, setTheme } = useColorTheme();
  const { locale } = useTranslation();
  const changeLocale = useChangeLocale();
  const installApp = useInstallApp();

  return {
    theme: theme ?? 'dark',
    setTheme,
    locale,
    changeLocale: (next: Locale) => {
      if (next !== locale) changeLocale(next);
    },
    installApp,
    isAdmin,
    signOut: () => void logout(),
  };
}
