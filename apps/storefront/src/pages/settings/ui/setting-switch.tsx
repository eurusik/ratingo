'use client';

import { Description, Label, Switch } from '@heroui/react';

interface SettingSwitchProps {
  label: string;
  hint: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (isSelected: boolean) => void;
}

export function SettingSwitch({
  label,
  hint,
  isSelected,
  isDisabled = false,
  onChange,
}: SettingSwitchProps) {
  return (
    <Switch
      isSelected={isSelected}
      isDisabled={isDisabled}
      onChange={onChange}
      size="lg"
      className="min-h-16 w-full flex-row items-center gap-3 py-2.5 md:min-h-17 md:gap-4 md:py-3"
    >
      <Switch.Content className="min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
        <Label className="text-base font-normal">{label}</Label>
        <Description className="text-[13px] leading-snug text-muted md:text-sm">{hint}</Description>
      </Switch.Content>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}
