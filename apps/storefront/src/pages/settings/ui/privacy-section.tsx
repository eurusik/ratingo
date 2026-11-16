'use client';

import { interpolate, useTranslation } from '@/shared/i18n';
import { profileAddress, useAccount } from '../model/account';
import { useAccountToggles } from '../model/account-toggles';
import { CARD_LIST } from './settings-card';
import { SettingSwitch } from './setting-switch';

const PUBLIC_PROFILE = 'isProfilePublic';

const PROFILE_DETAILS = ['showWatchHistory', 'showRatings', 'allowFollowers'] as const;

type PrivacyToggle = typeof PUBLIC_PROFILE | (typeof PROFILE_DETAILS)[number];

export function PrivacySection() {
  const { dict } = useTranslation();
  const copy = dict.settings.privacy;
  const user = useAccount();
  const toggles = useAccountToggles();
  const isPublic = toggles.isOn(PUBLIC_PROFILE);
  const url = profileAddress(user.username);

  const switchFor = (toggle: PrivacyToggle, isDisabled = false) => (
    <li key={toggle}>
      <SettingSwitch
        label={copy[toggle].label}
        hint={interpolate(copy[toggle].hint, { url })}
        isSelected={toggles.isOn(toggle)}
        isDisabled={isDisabled}
        onChange={(value) => toggles.set(toggle, value)}
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <ul className={CARD_LIST}>
        {switchFor(PUBLIC_PROFILE)}
        {PROFILE_DETAILS.map((toggle) => switchFor(toggle, !isPublic))}
      </ul>
      {isPublic ? (
        <p className="mx-1 text-[13px] text-muted md:mx-0 md:text-sm">{copy.note}</p>
      ) : (
        <p
          role="status"
          className="rounded-[14px] bg-default px-3.5 py-3 text-sm leading-snug text-foreground/85"
        >
          {interpolate(copy.privateNote, { url })}
        </p>
      )}
    </div>
  );
}
