/**
 * Settings page client component with tabs.
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import type { MeDto } from '@/core/api';
import { ProfileSection } from './profile-section';
import { PrivacySection } from './privacy-section';
import { SecuritySection } from './security-section';
import { useUpdateProfile } from '../hooks';

interface SettingsPageClientProps {
  user: MeDto;
  initialTab?: 'profile' | 'privacy' | 'security';
}

/**
 * Settings page with tabs for Profile, Privacy, and Security.
 * Unsaved changes warning for Profile/Security only.
 */
export function SettingsPageClient({ user, initialTab = 'profile' }: SettingsPageClientProps) {
  const { dict } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateProfile = useUpdateProfile();

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

  const handlePrivacyUpdate = async (field: 'isProfilePublic' | 'showWatchHistory' | 'showRatings' | 'allowFollowers', value: boolean) => {
    await updateProfile.mutateAsync({
      [field]: value,
    });
  };

  return (
    <div className="container max-w-xl mx-auto pt-24 pb-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">
          {dict.settings.title}
        </h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
          <TabsTrigger value="profile" className="data-[state=active]:bg-zinc-800">
            {dict.settings.tabs.profile}
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-zinc-800">
            {dict.settings.tabs.privacy}
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-zinc-800">
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
            <SecuritySection />
          </TabsContent>
      </Tabs>
    </div>
  );
}
