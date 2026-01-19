/**
 * Auth modal component with login/register forms.
 * Uses shadcn Dialog for accessibility and animations.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  /** Whether modal is open. */
  isOpen: boolean;
  /** Close modal callback. */
  onClose: () => void;
  /** Initial mode. */
  initialMode?: AuthMode;
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { dict } = useTranslation();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Reset mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  const handleSuccess = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="bg-cinema-card border-cinema-borderSoft sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-cinema-text-primary">
            {mode === 'login' ? dict.auth.loginTitle : dict.auth.registerTitle}
          </DialogTitle>
          <DialogDescription className="text-cinema-text-muted">
            {mode === 'login' ? dict.auth.loginSubtitle : dict.auth.registerSubtitle}
          </DialogDescription>
        </DialogHeader>

        {mode === 'login' ? (
          <LoginForm onSuccess={handleSuccess} onSwitchToRegister={() => setMode('register')} />
        ) : (
          <RegisterForm onSuccess={handleSuccess} onSwitchToLogin={() => setMode('login')} />
        )}
      </DialogContent>
    </Dialog>
  );
}
