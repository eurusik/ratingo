/**
 * Profile section component with form for editing user profile.
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { Button, Input, Label, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui';
import { cn } from '@/shared/utils';
import { REGION_GROUPS } from '@/shared/constants';
import type { MeDto } from '@/core/api';
import { createProfileSchema, type ProfileFormData } from '../schemas';
import { useUpdateProfile } from '../hooks';
import { AvatarUploader } from './avatar-uploader';

interface ProfileSectionProps {
  user: MeDto;
  onSuccess: () => void;
}

/** Profile editing form with username confirmation dialog. */
export function ProfileSection({ user, onSuccess }: ProfileSectionProps) {
  const { dict } = useTranslation();
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<ProfileFormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => createProfileSchema(dict), [dict]);
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    watch,
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user.username,
      bio: user.profile.bio || '',
      location: user.profile.location || '',
      website: user.profile.website || '',
      preferredLanguage: (user.profile.preferredLanguage as 'uk' | 'en') || 'uk',
      preferredRegion: user.profile.preferredRegion || 'UA',
    },
  });

  const currentUsername = watch('username');
  const usernameChanged = currentUsername !== user.username;

  // Expose isDirty for parent component (unsaved changes warning)
  useEffect(() => {
    // Store isDirty in a way parent can access it
    // For now, we'll handle it in the parent via beforeunload
  }, [isDirty]);

  const onSubmit = async (data: ProfileFormData) => {
    setError(null);

    // If username changed, show confirmation dialog
    if (data.username !== user.username) {
      setPendingData(data);
      setShowUsernameConfirm(true);
      return;
    }

    // Otherwise, submit directly
    await submitProfile(data);
  };

  const submitProfile = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync({
        username: data.username,
        bio: data.bio || undefined,
        location: data.location || undefined,
        website: data.website || '',
        preferredLanguage: data.preferredLanguage,
        preferredRegion: data.preferredRegion,
      });
      onSuccess();
    } catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 409) {
        setError(dict.settings.errors.usernameTaken);
      } else {
        setError(dict.settings.errors.saveFailed);
      }
    }
  };

  const handleUsernameConfirm = async () => {
    if (!pendingData) return;

    setShowUsernameConfirm(false);
    await submitProfile(pendingData);
    setPendingData(null);
  };

  const handleUsernameCancel = () => {
    setShowUsernameConfirm(false);
    setPendingData(null);
  };

  const handleAvatarUploadSuccess = (newUrl: string) => {
    // Avatar is updated via optimistic update in the hook
    // Just show success feedback
    onSuccess();
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar */}
        <div>
          <AvatarUploader
            currentAvatarUrl={user.avatarUrl}
            onUploadSuccess={handleAvatarUploadSuccess}
          />
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username" className="text-zinc-200">
            {dict.settings.profile.username}
          </Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            className={cn(
              'bg-zinc-800 border-zinc-700 text-zinc-100',
              errors.username && 'border-red-500 focus-visible:ring-red-500'
            )}
            {...register('username')}
          />
          {errors.username && (
            <p className="text-xs text-red-400">{errors.username.message}</p>
          )}
          {usernameChanged && !errors.username && (
            <p className="text-xs text-yellow-400">{dict.settings.profile.usernameHint}</p>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio" className="text-zinc-200">
            {dict.settings.profile.bio}
          </Label>
          <textarea
            id="bio"
            rows={3}
            placeholder={dict.settings.profile.bioPlaceholder}
            className={cn(
              'flex w-full rounded-md border bg-zinc-800 border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50',
              errors.bio && 'border-red-500 focus-visible:ring-red-500'
            )}
            {...register('bio')}
          />
          {errors.bio && (
            <p className="text-xs text-red-400">{errors.bio.message}</p>
          )}
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location" className="text-zinc-200">
            {dict.settings.profile.location}
          </Label>
          <Input
            id="location"
            type="text"
            placeholder={dict.settings.profile.locationPlaceholder}
            className={cn(
              'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500',
              errors.location && 'border-red-500 focus-visible:ring-red-500'
            )}
            {...register('location')}
          />
          {errors.location && (
            <p className="text-xs text-red-400">{errors.location.message}</p>
          )}
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="website" className="text-zinc-200">
            {dict.settings.profile.website}
          </Label>
          <Input
            id="website"
            type="url"
            placeholder={dict.settings.profile.websitePlaceholder}
            className={cn(
              'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500',
              errors.website && 'border-red-500 focus-visible:ring-red-500'
            )}
            {...register('website')}
          />
          {errors.website && (
            <p className="text-xs text-red-400">{errors.website.message}</p>
          )}
        </div>

        {/* Language & Region */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="language" className="text-zinc-200">
              {dict.settings.profile.language}
            </Label>
            <select
              id="language"
              className="flex h-10 w-full rounded-md border bg-zinc-800 border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              {...register('preferredLanguage')}
            >
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region" className="text-zinc-200">
              {dict.settings.profile.region}
            </Label>
            <select
              id="region"
              className="flex h-10 w-full rounded-md border bg-zinc-800 border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              {...register('preferredRegion')}
            >
              {REGION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.regions.map((region) => (
                    <option key={region.code} value={region.code}>
                      {region.flag} {region.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
            {error}
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="w-full"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {isSubmitting ? dict.settings.saving : dict.common.save}
        </Button>
      </form>

      {/* Username confirmation dialog */}
      <Dialog open={showUsernameConfirm} onOpenChange={setShowUsernameConfirm}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {dict.settings.confirmUsernameChange.title}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {dict.settings.confirmUsernameChange.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleUsernameCancel}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            >
              {dict.settings.confirmUsernameChange.cancel}
            </Button>
            <Button onClick={handleUsernameConfirm}>
              {dict.settings.confirmUsernameChange.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
