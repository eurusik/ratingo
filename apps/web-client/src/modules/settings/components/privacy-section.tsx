/**
 * Privacy section component with toggle switches for privacy settings.
 */

'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Label } from '@/shared/ui';
import type { MeDto } from '@/core/api';
import type { components } from '@ratingo/api-contract';

type PrivacyDto = components['schemas']['PrivacyDto'];
type PrivacyField = keyof PrivacyDto;

export type { PrivacyField };

interface PrivacySectionProps {
  user: MeDto;
  onUpdate: (field: PrivacyField, value: boolean) => Promise<void>;
}

interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Custom toggle switch component. */
function Toggle({ id, label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-zinc-200 cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-sm text-zinc-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-blue-600' : 'bg-zinc-700'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

/**
 * Privacy settings section with auto-save toggles.
 * No unsaved changes warning (auto-save behavior).
 */
export function PrivacySection({ user, onUpdate }: PrivacySectionProps) {
  const { dict } = useTranslation();
  const [updatingField, setUpdatingField] = useState<PrivacyField | null>(null);
  
  // Local state for optimistic updates
  const [localValues, setLocalValues] = useState({
    isProfilePublic: user.profile.privacy?.isProfilePublic ?? true,
    showWatchHistory: user.profile.privacy?.showWatchHistory ?? false,
    showRatings: user.profile.privacy?.showRatings ?? true,
    allowFollowers: user.profile.privacy?.allowFollowers ?? true,
  });

  const handleToggle = async (field: PrivacyField, value: boolean) => {
    const previousValue = localValues[field];
    
    // Optimistic update
    setLocalValues((prev) => ({ ...prev, [field]: value }));
    setUpdatingField(field);
    
    try {
      await onUpdate(field, value);
    } catch {
      // Rollback on error
      setLocalValues((prev) => ({ ...prev, [field]: previousValue }));
    } finally {
      setUpdatingField(null);
    }
  };

  const privacyFields: { id: PrivacyField; label: string; description?: string }[] = [
    { id: 'isProfilePublic', label: dict.settings.privacy.publicProfile, description: dict.settings.privacy.publicProfileHint },
    { id: 'showWatchHistory', label: dict.settings.privacy.showHistory },
    { id: 'showRatings', label: dict.settings.privacy.showRatings },
    { id: 'allowFollowers', label: dict.settings.privacy.allowFollowers },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-zinc-100 mb-4">
          {dict.settings.privacy.title}
        </h3>

        <div className="space-y-1 divide-y divide-zinc-800">
          {privacyFields.map((field) => (
            <Toggle
              key={field.id}
              id={field.id}
              label={field.label}
              description={field.description}
              checked={localValues[field.id]}
              onChange={(value) => handleToggle(field.id, value)}
              disabled={updatingField === field.id}
            />
          ))}
        </div>

        {!localValues.isProfilePublic && (
          <div className="mt-4 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
            {dict.settings.privacy.privateProfileNote}
          </div>
        )}
      </div>
    </div>
  );
}
