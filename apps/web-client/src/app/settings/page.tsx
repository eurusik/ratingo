/**
 * Settings page - user profile and account settings.
 */

'use client';

import { useAuth } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import { SettingsPageClient } from '@/modules/settings';
import { Skeleton } from '@/shared/ui/skeleton';

/** Settings page with auth guard. */
export default function SettingsPage() {
  const { dict } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="container max-w-xl mx-auto px-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="container max-w-xl mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h1 className="text-2xl font-bold text-zinc-100 mb-4">
              {dict.settings.title}
            </h1>
            <p className="text-zinc-500">
              {dict.auth.loginSubtitle}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated
  return <SettingsPageClient user={user} />;
}
