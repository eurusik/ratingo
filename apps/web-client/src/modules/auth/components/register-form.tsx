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

interface RegisterFormProps {
  /** Callback after successful registration. */
  onSuccess?: () => void;
  /** Switch to login form. */
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
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
        <Label htmlFor="username" className="text-zinc-200">
          {dict.auth.username}
        </Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          placeholder="ratingo_fan"
          className={cn(
            'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500',
            errors.username && 'border-red-500 focus-visible:ring-red-500'
          )}
          {...register('username')}
        />
        {errors.username && (
          <p className="text-xs text-red-400">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-200">
          {dict.auth.password}
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
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

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-zinc-200">
          {dict.auth.confirmPassword}
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••"
          className={cn(
            'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500',
            errors.confirmPassword && 'border-red-500 focus-visible:ring-red-500'
          )}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
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
        {isSubmitting ? dict.auth.registering : dict.auth.register}
      </Button>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-zinc-400">
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
  );
}
