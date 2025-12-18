/**
 * Login form component.
 */

'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import { Button, Input, Label, Alert, AlertDescription } from '@/shared/ui';
import { createLoginSchema, type LoginFormData } from '../schemas';
import { cn } from '@/shared/utils';

interface LoginFormProps {
  /** Callback after successful login. */
  onSuccess?: () => void;
  /** Switch to register form. */
  onSwitchToRegister?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const { login } = useAuth();
  const { dict } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => createLoginSchema(dict), [dict]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.auth.errors.loginFailed);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-zinc-200">
          {dict.auth.email}
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="user@example.com"
          className={cn(
            'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500',
            errors.email && 'border-red-500 focus-visible:ring-red-500'
          )}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-200">
          {dict.auth.password}
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••"
          className={cn(
            'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500',
            errors.password && 'border-red-500 focus-visible:ring-red-500'
          )}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {isSubmitting ? dict.auth.loggingIn : dict.auth.login}
      </Button>

      {onSwitchToRegister && (
        <p className="text-center text-sm text-zinc-400">
          {dict.auth.noAccount}{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {dict.auth.register}
          </button>
        </p>
      )}
    </form>
  );
}
