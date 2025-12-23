/**
 * Security section component with password change form.
 */

'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { Button, Input, Label } from '@/shared/ui';
import { cn } from '@/shared/utils';
import { createPasswordSchema, type PasswordFormData } from '../schemas';
import { useChangePassword } from '../hooks';
import { ApiError } from '@/core/api';

/**
 * Password change form with validation.
 * Wrong password errors shown inline only (no toast).
 */
export function SecuritySection() {
  const { dict } = useTranslation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const schema = useMemo(() => createPasswordSchema(dict), [dict]);
  const changePassword = useChangePassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setError,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: PasswordFormData) => {
    setSuccessMessage(null);

    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      reset();
      setSuccessMessage(dict.settings.saved);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      // Handle wrong password (403) - inline only
      if (err instanceof ApiError && err.statusCode === 403) {
        setError('currentPassword', {
          message: dict.settings.errors.wrongPassword,
        });
      } else {
        setError('root', {
          message: dict.settings.errors.saveFailed,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-zinc-100 mb-4">
          {dict.settings.security.title}
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-zinc-200">
              {dict.settings.security.currentPassword}
            </Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              className={cn(
                'bg-zinc-800 border-zinc-700 text-zinc-100',
                errors.currentPassword && 'border-red-500 focus-visible:ring-red-500'
              )}
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p className="text-xs text-red-400">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-zinc-200">
              {dict.settings.security.newPassword}
            </Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className={cn(
                'bg-zinc-800 border-zinc-700 text-zinc-100',
                errors.newPassword && 'border-red-500 focus-visible:ring-red-500'
              )}
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-xs text-red-400">{errors.newPassword.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-zinc-200">
              {dict.settings.security.confirmPassword}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={cn(
                'bg-zinc-800 border-zinc-700 text-zinc-100',
                errors.confirmPassword && 'border-red-500 focus-visible:ring-red-500'
              )}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Root error (other errors) */}
          {errors.root && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
              {errors.root.message}
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-md p-3">
              {successMessage}
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="w-full"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isSubmitting ? dict.settings.saving : dict.settings.security.changePassword}
          </Button>
        </form>
      </div>
    </div>
  );
}
