'use client';

import { useState, type ReactNode } from 'react';
import { Button, FieldError, InputGroup, Label, TextField } from '@heroui/react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

interface PasswordFieldProps {
  autoComplete: 'current-password' | 'new-password';
  value: string;
  onChange: (value: string) => void;
  validate: (value: string) => string | null;
  describedBy?: string;
  children?: ReactNode;
}

export function PasswordField({
  autoComplete,
  value,
  onChange,
  validate,
  describedBy,
  children,
}: PasswordFieldProps) {
  const { dict } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const ToggleIcon = isVisible ? EyeOff : Eye;

  return (
    <TextField
      name="password"
      type={isVisible ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
      validate={validate}
      isRequired
      fullWidth
      aria-describedby={describedBy}
    >
      <Label>{dict.auth.password}</Label>
      <InputGroup fullWidth>
        <InputGroup.Input className="text-base" />
        <InputGroup.Suffix>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={isVisible ? dict.auth.hidePassword : dict.auth.showPassword}
            aria-pressed={isVisible}
            onPress={() => setIsVisible((visible) => !visible)}
          >
            <ToggleIcon aria-hidden className="size-[18px]" />
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {children}
      <FieldError />
    </TextField>
  );
}
