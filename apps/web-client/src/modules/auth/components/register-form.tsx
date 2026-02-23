/**
 * Register form component.
 */

'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import { Button, Input, Label, Alert, AlertDescription } from '@/shared/ui';
import { createRegisterSchema, type RegisterFormData } from '../schemas';
import { cn } from '@/shared/utils';
import { GoogleButton } from './google-button';
import { FacebookButton } from './facebook-button';

interface RegisterFormProps {
  /** Callback after successful registration. */
  onSuccess?: () => void;
  /** Switch to login form. */
  onSwitchToLogin?: () => void;
  /** URL to redirect to after successful registration. */
  returnTo?: string;
}

export function RegisterForm({ onSuccess, onSwitchToLogin, returnTo }: RegisterFormProps) {
  const { register: registerUser } = useAuth();
  const { dict } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => createRegisterSchema(dict), [dict]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    try {
      await registerUser({
        email: data.email,
        username: data.username,
        password: data.password,
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.auth.errors.registerFailed);
    }
  };

  return (
    <div className="space-y-4">
      <GoogleButton returnTo={returnTo} mode="register" />
      <FacebookButton returnTo={returnTo} mode="register" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-cinema-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-cinema-card px-2 text-cinema-text-muted">{dict.auth.or}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-cinema-text-primary">
            {dict.auth.email}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="user@example.com"
            className={cn(
              'bg-cinema-elevated border-cinema-border text-cinema-text-primary placeholder:text-cinema-text-muted',
              errors.email && 'border-red-500 focus-visible:ring-red-500',
            )}
            {...register('email')}
          />
          {errors.email && <p data-testid="email-error" className="text-xs text-red-400">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username" className="text-cinema-text-primary">
            {dict.auth.username}
          </Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="ratingo_fan"
            className={cn(
              'bg-cinema-elevated border-cinema-border text-cinema-text-primary placeholder:text-cinema-text-muted',
              errors.username && 'border-red-500 focus-visible:ring-red-500',
            )}
            {...register('username')}
          />
          {errors.username && <p data-testid="username-error" className="text-xs text-red-400">{errors.username.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-cinema-text-primary">
            {dict.auth.password}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••"
            className={cn(
              'bg-cinema-elevated border-cinema-border text-cinema-text-primary placeholder:text-cinema-text-muted',
              errors.password && 'border-red-500 focus-visible:ring-red-500',
            )}
            {...register('password')}
          />
          {errors.password && <p data-testid="password-error" className="text-xs text-red-400">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-cinema-text-primary">
            {dict.auth.confirmPassword}
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••"
            className={cn(
              'bg-cinema-elevated border-cinema-border text-cinema-text-primary placeholder:text-cinema-text-muted',
              errors.confirmPassword && 'border-red-500 focus-visible:ring-red-500',
            )}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p data-testid="confirmPassword-error" className="text-xs text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>

        {error && (
          <Alert data-testid="form-error" variant="destructive" className="bg-red-500/10 border-red-500/20">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {isSubmitting ? dict.auth.registering : dict.auth.register}
        </Button>

        {onSwitchToLogin && (
          <p className="text-center text-sm text-cinema-text-muted">
            {dict.auth.hasAccount}{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {dict.auth.login}
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
