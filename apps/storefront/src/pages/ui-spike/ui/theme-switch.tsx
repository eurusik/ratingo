'use client';

import { Switch } from '@heroui/react';
import { useColorTheme } from '@ratingo/ui/theme';

export function ThemeSwitch() {
  const { theme, setTheme } = useColorTheme();

  return (
    <Switch
      isDisabled={!theme}
      isSelected={theme === 'dark'}
      onChange={(isDark) => setTheme(isDark ? 'dark' : 'light')}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Темна тема
      </Switch.Content>
    </Switch>
  );
}
