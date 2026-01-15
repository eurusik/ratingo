'use client';

/**
 * Image uploader with drag & drop and progress indicator.
 */

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import Image from 'next/image';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Progress } from '@/shared/ui/progress';
import { cn } from '@/shared/utils';

import { useImageUpload } from '../../hooks';

export interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

/**
 * Image uploader with drag & drop support.
 */
export function ImageUploader({ value, onChange, className }: ImageUploaderProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload, state } = useImageUpload();
  const { isUploading, progress } = state;

  const handleFile = async (file: File) => {
    try {
      const url = await upload(file);
      onChange(url);
    } catch {
      // Error handled by hook
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  if (value) {
    return (
      <div className={cn('relative', className)}>
        <div className="relative aspect-video rounded-lg overflow-hidden border">
          <Image
            src={value}
            alt="Featured image"
            fill
            className="object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="sr-only"
        id="image-upload"
      />
      <label
        htmlFor="image-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          isUploading && 'pointer-events-none opacity-50',
        )}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <span className="text-sm text-muted-foreground">
              {t('admin.journal.uploadingImage')}
            </span>
            <Progress value={progress} className="w-full max-w-xs" />
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('admin.journal.form.featuredImageHint')}
            </span>
          </>
        )}
      </label>
    </div>
  );
}
