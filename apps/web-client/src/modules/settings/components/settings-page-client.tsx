/**
 * Settings page client component with tabs.
 */

'use client';

import { useState, useEffect } from 'react';

import { CheckCircle, AlertCircle, X } from 'lucide-react';

import { useTranslation } from '@/shared/i18n';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import type { MeDto } from '@/core/api';
import type { components } from '@ratingo/api-contract';
import { ProfileSection } from './profile-section';
import { PrivacySection } from './privacy-section';
import { SecuritySection } from './security-section';
import { ConnectedAccountsSection } from './connected-accounts-section';
import { useUpdateProfile } from '../hooks';

/** Notification from OAuth link callback redirect. */
export interface LinkNotification {
  type: 'success' | 'error';
  provider: string;
  code?: string;
}

interface SettingsPageClientProps {
  user: MeDto;
  initialTab?: 'profile' | 'privacy' | 'security';
  linkNotification?: LinkNotification;
}

/**
 * Settings page with tabs for Profile, Privacy, and Security.
 * Unsaved changes warning for Profile/Security only.
 */
export function SettingsPageClient({
  user,
  initialTab = 'profile',
  linkNotification,
}: SettingsPageClientProps) {
  const { dict } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notification, setNotification] = useState(linkNotification);

  const updateProfile = useUpdateProfile();

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(undefined), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Handle unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && (activeTab === 'profile' || activeTab === 'security')) {
        e.preventDefault();
        e.returnValue = dict.settings.unsavedChanges;
        return dict.settings.unsavedChanges;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, activeTab, dict]);

  const handleProfileSuccess = () => {
    setHasUnsavedChanges(false);
    // Could show toast here
  };

  const handlePrivacyUpdate = async (
    field: keyof components['schemas']['PrivacyDto'],
    value: boolean,
  ) => {
    await updateProfile.mutateAsync({
      [field]: value,
    });
  };

  const t = dict.settings.connectedAccounts;
  const capitalizedProvider = notification?.provider
    ? notification.provider.charAt(0).toUpperCase() + notification.provider.slice(1)
    : '';

  return (
    <div className="container max-w-xl mx-auto pt-24 pb-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-cinema-text-primary">{dict.settings.title}</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="bg-cinema-card border border-cinema-borderSoft mb-6">
          <TabsTrigger value="profile" className="data-[state=active]:bg-cinema-elevated">
            {dict.settings.tabs.profile}
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-cinema-elevated">
            {dict.settings.tabs.privacy}
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-cinema-elevated">
            {dict.settings.tabs.security}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0 space-y-6">
          <ProfileSection user={user} onSuccess={handleProfileSuccess} />
        </TabsContent>

        <TabsContent value="privacy" className="mt-0 space-y-6">
          <PrivacySection user={user} onUpdate={handlePrivacyUpdate} />
        </TabsContent>

        <TabsContent value="security" className="mt-0 space-y-6">
          {notification && (
            <Alert
              variant={notification.type === 'success' ? 'default' : 'destructive'}
              className={
                notification.type === 'success'
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : undefined
              }
            >
              {notification.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {notification.type === 'success'
                    ? t.linkSuccess.replace('{provider}', capitalizedProvider)
                    : t.linkError}
                </span>
                <button
                  onClick={() => setNotification(undefined)}
                  className="ml-2 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </AlertDescription>
            </Alert>
          )}
          <ConnectedAccountsSection />
          <SecuritySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
