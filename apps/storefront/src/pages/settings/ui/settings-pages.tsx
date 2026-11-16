'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/shared/i18n';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { useMediaQuery } from '@/shared/lib';
import { profileAddress, useAccount, visibilityOf } from '../model/account';
import { useLeaveConfirmation } from '../model/leave-guard';
import { useFollowedSummary } from '../model/followed-queries';
import { useSignInSummary } from '../model/method-names';
import { useProfileForm } from '../model/profile-form';
import type { SettingsSection } from '../model/settings-sections';
import { DiscardDialog } from './discard-dialog';
import { NotificationsSection } from './notifications-section';
import { PrivacySection } from './privacy-section';
import { ProfileSection } from './profile-section';
import { SecuritySection } from './security-section';
import { SectionHeader } from './settings-headers';
import { SettingsList } from './settings-list';
import { SettingsShell } from './settings-shell';

function SectionPage({ section, children }: { section: SettingsSection; children: ReactNode }) {
  const { dict } = useTranslation();
  const title = dict.settings.sections[section];
  return (
    <SettingsShell current={section} phoneTitle={title} desktopTitle={title}>
      {children}
    </SettingsShell>
  );
}

function ProfileContent() {
  const { dict } = useTranslation();
  const { username } = useAccount();
  const form = useProfileForm();
  const confirmation = useLeaveConfirmation(form.isDirty, form.reset);

  return (
    <>
      <SectionHeader
        title={dict.settings.sections.profile}
        subtitle={<span translate="no">{profileAddress(username)}</span>}
      />
      <ProfileSection form={form} />
      <DiscardDialog
        isOpen={confirmation.isAsking}
        onKeep={confirmation.stay}
        onDiscard={confirmation.leave}
      />
    </>
  );
}

export function SettingsHomePage() {
  const { dict } = useTranslation();
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

  return (
    <SettingsShell
      current="profile"
      phoneTitle={dict.settings.title}
      desktopTitle={dict.settings.sections.profile}
      backTo="my"
    >
      {isDesktop ? <ProfileContent /> : <SettingsList />}
    </SettingsShell>
  );
}

export function ProfileSettingsPage() {
  return (
    <SectionPage section="profile">
      <ProfileContent />
    </SectionPage>
  );
}

function SecurityContent() {
  const { dict } = useTranslation();
  const signInSummary = useSignInSummary();
  return (
    <>
      <SectionHeader title={dict.settings.sections.security} subtitle={signInSummary} />
      <SecuritySection />
    </>
  );
}

export function SecuritySettingsPage() {
  return (
    <SectionPage section="security">
      <SecurityContent />
    </SectionPage>
  );
}

function NotificationsContent() {
  const { dict } = useTranslation();
  const followedSummary = useFollowedSummary();
  return (
    <>
      <SectionHeader title={dict.settings.sections.notifications} subtitle={followedSummary} />
      <NotificationsSection />
    </>
  );
}

export function NotificationSettingsPage() {
  return (
    <SectionPage section="notifications">
      <NotificationsContent />
    </SectionPage>
  );
}

function PrivacyContent() {
  const { dict } = useTranslation();
  const visibility = visibilityOf(useAccount());
  return (
    <>
      <SectionHeader
        title={dict.settings.sections.privacy}
        subtitle={dict.settings.privacy.subtitle[visibility]}
      />
      <PrivacySection />
    </>
  );
}

export function PrivacySettingsPage() {
  return (
    <SectionPage section="privacy">
      <PrivacyContent />
    </SectionPage>
  );
}
