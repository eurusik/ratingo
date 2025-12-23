/**
 * Avatar uploader component with file validation and preview.
 */

'use client';

import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { useTranslation } from '@/shared/i18n';
import { useAvatarUpload } from '../hooks';

interface AvatarUploaderProps {
  currentAvatarUrl: string | null;
  onUploadSuccess: (newUrl: string) => void;
}

const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validates avatar file against MIME type and size constraints.
 */
function validateAvatarFile(file: File, dict: ReturnType<typeof useTranslation>['dict']): string | null {
  if (!VALID_MIME_TYPES.includes(file.type as typeof VALID_MIME_TYPES[number])) {
    return dict.settings.errors.invalidFileType;
  }

  if (file.size > MAX_FILE_SIZE) {
    return dict.settings.errors.fileTooLarge;
  }

  return null;
}

/** Avatar uploader with file picker, validation, and preview. */
export function AvatarUploader({ currentAvatarUrl, onUploadSuccess }: AvatarUploaderProps) {
  const { dict } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAvatar = useAvatarUpload();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset error
    setError(null);

    // Validate file
    const validationError = validateAvatarFile(file, dict);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload
    uploadAvatar.mutate(
      { file },
      {
        onSuccess: (data) => {
          onUploadSuccess(data.avatarUrl ?? '');
          setPreviewUrl(null);
        },
        onError: () => {
          setError(dict.settings.errors.uploadFailed);
          setPreviewUrl(null);
        },
      }
    );
  };

  const displayUrl = previewUrl || currentAvatarUrl;
  const isUploading = uploadAvatar.isPending;

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={displayUrl || undefined} alt="Avatar" />
        <AvatarFallback>
          <svg
            className="h-10 w-10 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={isUploading}
        >
          {isUploading ? dict.settings.avatar.uploading : dict.settings.avatar.change}
        </Button>

        <div className="text-xs text-muted-foreground">
          <div>{dict.settings.avatar.formats} • {dict.settings.avatar.maxSize}</div>
          <div className="text-muted-foreground/70">{dict.settings.avatar.squareHint}</div>
        </div>

        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>
    </div>
  );
}
