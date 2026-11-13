'use client';

import { useState } from 'react';
import { closeAuth, useAuthRequest, type AuthMode, type AuthRequest } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ResponsiveDialog } from '@/shared/ui';
import { LoginForm } from './login-form';
import { OAuthButtons } from './oauth-buttons';
import { RegisterForm } from './register-form';

interface ModeChoice {
  request: AuthRequest;
  mode: AuthMode;
}

function useShownRequest(request: AuthRequest | null): AuthRequest | null {
  const [shown, setShown] = useState(request);
  if (request && request !== shown) setShown(request);
  return request ?? shown;
}

export function AuthDialog() {
  const { dict } = useTranslation();
  const request = useAuthRequest();
  const shown = useShownRequest(request);
  const [choice, setChoice] = useState<ModeChoice | null>(null);

  if (!shown) return null;

  const mode = choice?.request === shown ? choice.mode : shown.mode;
  const chooseMode = (next: AuthMode) => setChoice({ request: shown, mode: next });
  const modeTitle = mode === 'login' ? dict.auth.loginTitle : dict.auth.registerTitle;
  const title =
    shown.intent && mode === 'login'
      ? interpolate(dict.auth.intent.save, { title: shown.intent.title })
      : modeTitle;

  const finish = () => {
    closeAuth();
    shown.onSignedIn?.();
  };

  return (
    <ResponsiveDialog
      isOpen={request !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeAuth();
      }}
      title={title}
      size="full"
    >
      <div className="flex flex-col gap-5">
        <p className="text-base text-muted">
          {mode === 'login' ? dict.auth.loginLead : dict.auth.registerLead}
        </p>
        <OAuthButtons />
        {mode === 'login' ? (
          <LoginForm onSignedIn={finish} onRegister={() => chooseMode('register')} />
        ) : (
          <RegisterForm onSignedIn={finish} onLogin={() => chooseMode('login')} />
        )}
      </div>
    </ResponsiveDialog>
  );
}
