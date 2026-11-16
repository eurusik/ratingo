'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/shared/i18n';
import { isPlainClick } from '@/shared/lib';
import { EmptyState } from '@/shared/ui';
import { profileAddress, useAccount, visibilityOf } from '../model/account';
import { useLeaveGuard } from '../model/leave-guard';
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
  const router = useRouter();
  const { username } = useAccount();
  const form = useProfileForm();
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  useLeaveGuard(
    form.isDirty
      ? (event, href) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          setLeaveTarget(href);
        }
      : null,
  );

  const discard = () => {
    form.reset();
    setLeaveTarget(null);
    if (leaveTarget) router.push(leaveTarget);
  };

  return (
    <>
      <SectionHeader title={dict.settings.sections.profile} subtitle={profileAddress(username)} />
      <ProfileSection form={form} />
      <DiscardDialog
        isOpen={leaveTarget !== null}
        onKeep={() => setLeaveTarget(null)}
        onDiscard={discard}
      />
    </>
  );
}

export function SettingsHomePage() {
  const { dict } = useTranslation();

  return (
    <SettingsShell
      current="profile"
      phoneTitle={dict.settings.title}
      desktopTitle={dict.settings.sections.profile}
      backTo="my"
    >
      <div className="md:hidden">
        <SettingsList />
      </div>
      <div className="flex flex-col gap-3 max-md:hidden">
        <ProfileContent />
      </div>
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

function ImportContent() {
  const { dict } = useTranslation();
  return (
    <>
      <SectionHeader title={dict.settings.sections.import} />
      <EmptyState title={dict.settings.importSoon.title} text={dict.settings.importSoon.text} />
    </>
  );
}

export function ImportSettingsPage() {
  return (
    <SectionPage section="import">
      <ImportContent />
    </SectionPage>
  );
}
