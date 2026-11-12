'use client';

import { useId, useState, useTransition, type FormEvent } from 'react';
import {
  Button,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  TextField,
} from '@heroui/react';
import { ApiError, ErrorCode, mapAuthError } from '@ratingo/web-core/api';
import { useAuth } from '@ratingo/web-core/auth';
import { useTranslation } from '@/shared/i18n';
import { isEmail } from '../model/email';
import { isStrongPassword } from '../model/password-rules';
import { findUsernameProblem, suggestUsername, type UsernameProblem } from '../model/username';
import { FormErrorBanner } from './form-error-banner';
import { ModeSwitch } from './mode-switch';
import { PasswordChecklist } from './password-checklist';
import { PasswordField } from './password-field';

type FieldConflict = 'email' | 'username' | null;

interface RegisterFormProps {
  onSignedIn: () => void;
  onLogin: () => void;
}

function conflictOf(error: unknown): FieldConflict {
  if (!(error instanceof ApiError)) return null;
  if (error.code === ErrorCode.EMAIL_ALREADY_EXISTS) return 'email';
  if (error.code === ErrorCode.USERNAME_ALREADY_EXISTS) return 'username';
  return null;
}

export function RegisterForm({ onSignedIn, onLogin }: RegisterFormProps) {
  const { dict } = useTranslation();
  const { register } = useAuth();
  const checklistId = useId();
  const [email, setEmail] = useState('');
  const [editedUsername, setEditedUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [conflict, setConflict] = useState<FieldConflict>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const usernameMessages: Record<UsernameProblem, string> = {
    length: dict.auth.validation.usernameLength,
    format: dict.auth.validation.usernameFormat,
  };
  const isUsernameSuggested = editedUsername === null;
  const username = editedUsername ?? (isEmail(email) ? suggestUsername(email) : '');

  const changeEmail = (value: string) => {
    setEmail(value);
    if (conflict === 'email') setConflict(null);
  };

  const changeUsername = (value: string) => {
    setEditedUsername(value);
    if (conflict === 'username') setConflict(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setConflict(null);
    startTransition(async () => {
      try {
        await register({ email: email.trim(), username, password });
        onSignedIn();
      } catch (registerError) {
        const fieldConflict = conflictOf(registerError);
        setConflict(fieldConflict);
        if (!fieldConflict) setError(mapAuthError(registerError, dict.auth.errors));
      }
    });
  };

  return (
    <Form onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={changeEmail}
        validate={(value) => (isEmail(value) ? null : dict.auth.validation.emailInvalid)}
        isInvalid={conflict === 'email' || undefined}
        isRequired
        fullWidth
      >
        <Label>{dict.auth.email}</Label>
        <Input variant="secondary" spellCheck="false" className="text-base" />
        <FieldError>
          {conflict === 'email' ? (
            <>
              {dict.auth.emailTaken}{' '}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto min-h-0 p-0 font-semibold text-accent"
                onPress={onLogin}
              >
                {dict.auth.signInInstead}
              </Button>
            </>
          ) : undefined}
        </FieldError>
      </TextField>
      <TextField
        name="username"
        autoComplete="nickname"
        spellCheck="false"
        value={username}
        onChange={changeUsername}
        validate={(value) => {
          const problem = findUsernameProblem(value);
          return problem ? usernameMessages[problem] : null;
        }}
        isInvalid={conflict === 'username' || undefined}
        isRequired
        fullWidth
      >
        <Label>{dict.auth.username}</Label>
        <InputGroup variant="secondary" fullWidth>
          <InputGroup.Input autoCapitalize="none" className="text-base" />
          {isUsernameSuggested && username ? (
            <InputGroup.Suffix>
              <Chip size="sm" variant="soft">
                {dict.auth.usernameSuggested}
              </Chip>
            </InputGroup.Suffix>
          ) : null}
        </InputGroup>
        <Description>{dict.auth.usernameHint}</Description>
        <FieldError>
          {conflict === 'username' ? dict.auth.errors.usernameTaken : undefined}
        </FieldError>
      </TextField>
      <PasswordField
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        validate={(value) => (isStrongPassword(value) ? null : dict.auth.validation.passwordWeak)}
        describedBy={checklistId}
      >
        <PasswordChecklist id={checklistId} password={password} />
      </PasswordField>
      <FormErrorBanner message={error} />
      <Button type="submit" size="lg" fullWidth isPending={isPending}>
        {dict.auth.submitRegister}
      </Button>
      <ModeSwitch question={dict.auth.haveAccount} action={dict.auth.signIn} onPress={onLogin} />
    </Form>
  );
}
