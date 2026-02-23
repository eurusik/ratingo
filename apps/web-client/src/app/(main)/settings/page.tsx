/**
 * Settings page - user profile and account settings.
 * Handles OAuth link callback query params (?linked= / ?linkError=).
 */

'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import { SettingsPageClient } from '@/modules/settings';
import type { LinkNotification } from '@/modules/settings';
import { Skeleton } from '@/shared/ui/skeleton';

/** Derive link notification and initial tab from search params. */
function parseLinkParams(searchParams: URLSearchParams): {
  initialTab?: 'security';
  linkNotification?: LinkNotification;
} {
  const linked = searchParams.get('linked');
  const linkError = searchParams.get('linkError');
  const provider = linked || searchParams.get('provider') || '';

  if (linked) {
    return {
      initialTab: 'security',
      linkNotification: { type: 'success', provider },
    };
  }

  if (linkError) {
    return {
      initialTab: 'security',
      linkNotification: { type: 'error', provider, code: linkError },
    };
  }

  return {};
}

/** Inner component that reads search params (requires Suspense boundary). */
function SettingsPageContent() {
  const { dict } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();

  // Parse link params once on mount to survive URL cleanup
  const linkParamsRef = useRef(parseLinkParams(searchParams));
  const { initialTab, linkNotification } = linkParamsRef.current;

  // Clean URL params without triggering React re-render/remount
  useEffect(() => {
    if (searchParams.has('linked') || searchParams.has('linkError')) {
      window.history.replaceState(null, '', '/settings');
    }
  }, [searchParams]);

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
            <h1 className="text-2xl font-bold text-cinema-text-primary mb-4">{dict.settings.title}</h1>
            <p className="text-cinema-text-muted">{dict.auth.loginSubtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated
  return (
    <SettingsPageClient
      user={user}
      initialTab={initialTab}
      linkNotification={linkNotification}
    />
  );
}

/** Settings page with Suspense boundary for useSearchParams. */
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
