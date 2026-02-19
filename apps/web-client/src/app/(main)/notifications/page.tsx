/**
 * Notifications page — user's event center.
 */

'use client';

import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import { NotificationsList } from '@/modules/saved';

function NotificationsPageContent() {
  const { dict } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen pt-8 md:pt-24 pb-6 md:pb-12">
        <div className="container mx-auto px-4">
          <div className="h-8 w-48 bg-cinema-elevated rounded animate-pulse mb-8" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-8 md:pt-24 pb-6 md:pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h1 className="text-2xl font-bold text-cinema-text-primary mb-4">
              {dict.notifications.title}
            </h1>
            <p className="text-cinema-text-muted">{dict.auth.loginSubtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-8 md:pt-24 pb-6 md:pb-12">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold text-cinema-text-primary mb-8">
          {dict.notifications.title}
        </h1>
        <NotificationsList />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return <NotificationsPageContent />;
}
