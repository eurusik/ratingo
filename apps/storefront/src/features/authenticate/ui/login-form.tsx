'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button, FieldError, Form, Input, Label, TextField } from '@heroui/react';
import { mapAuthError } from '@ratingo/web-core/api';
import { useAuth } from '@ratingo/web-core/auth';
import { useTranslation } from '@/shared/i18n';
import { isEmail } from '../model/email';
import { FormErrorBanner } from './form-error-banner';
import { ModeSwitch } from './mode-switch';
import { PasswordField } from './password-field';

interface LoginFormProps {
  onSignedIn: () => void;
  onRegister: () => void;
}

export function LoginForm({ onSignedIn, onRegister }: LoginFormProps) {
  const { dict } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await login({ email: email.trim(), password });
        onSignedIn();
      } catch (loginError) {
        setError(mapAuthError(loginError, dict.auth.errors));
      }
    });
  };

  return (
    <Form onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        value={email}
        onChange={setEmail}
        validate={(value) => (isEmail(value) ? null : dict.auth.validation.emailInvalid)}
        isRequired
        fullWidth
      >
        <Label>{dict.auth.email}</Label>
        <Input variant="secondary" spellCheck="false" className="text-base" />
        <FieldError />
      </TextField>
      <PasswordField
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        validate={(value) => (value ? null : dict.auth.validation.passwordRequired)}
      />
      <FormErrorBanner message={error} />
      <Button type="submit" size="lg" fullWidth isPending={isPending}>
        {dict.auth.submitLogin}
      </Button>
      <ModeSwitch
        question={dict.auth.noAccount}
        action={dict.auth.createAccount}
        onPress={onRegister}
      />
    </Form>
  );
}
