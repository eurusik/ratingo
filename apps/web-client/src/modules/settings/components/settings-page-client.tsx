/**
 * Settings page client component with tabs.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

import { toast } from 'sonner';

import { useTranslation } from '@/shared/i18n';
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
  const t = dict.settings.connectedAccounts;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const toastShown = useRef(false);

  const updateProfile = useUpdateProfile();

  // Show toast once on mount for OAuth link result
  useEffect(() => {
    if (!linkNotification || toastShown.current) return;
    toastShown.current = true;

    const provider = linkNotification.provider
      ? linkNotification.provider.charAt(0).toUpperCase() + linkNotification.provider.slice(1)
      : '';

    if (linkNotification.type === 'success') {
      toast.success(t.linkSuccess.replace('{provider}', provider));
    } else {
      toast.error(t.linkError);
    }
  }, [linkNotification, t]);

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
  };

  const handlePrivacyUpdate = async (
    field: keyof components['schemas']['PrivacyDto'],
    value: boolean,
  ) => {
    await updateProfile.mutateAsync({
      [field]: value,
    });
  };

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
          <ConnectedAccountsSection />
          <SecuritySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
