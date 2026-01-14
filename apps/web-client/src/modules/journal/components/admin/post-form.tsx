'use client';

/**
 * Form for creating and editing journal posts.
 */

import { useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { cn } from '@/shared/utils';

import { POST_TYPE_VALUES, type AdminJournalPost } from '../../types';
import { ImageUploader } from './image-uploader';
import { MarkdownEditor } from './markdown-editor';

function createPostFormSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('admin.journal.form.errors.titleRequired')),
    slug: z.string().optional(),
    type: z.enum(POST_TYPE_VALUES),
    body: z.string().min(1, t('admin.journal.form.errors.bodyRequired')),
    featuredImageUrl: z.string().nullable().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    publishedAt: z.string().optional(),
    isDraft: z.boolean(),
  });
}

export type PostFormValues = z.infer<ReturnType<typeof createPostFormSchema>>;

export interface PostFormProps {
  initialValues?: Partial<AdminJournalPost>;
  onSubmit: (values: PostFormValues) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Form for creating/editing journal posts.
 */
export function PostForm({ initialValues, onSubmit, isLoading, className }: PostFormProps) {
  const { t } = useTranslation();

  const schema = useMemo(() => createPostFormSchema(t), [t]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<PostFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialValues?.title ?? '',
      slug: initialValues?.slug ?? '',
      type: initialValues?.type ?? 'update',
      body: initialValues?.body ?? '',
      featuredImageUrl: initialValues?.featuredImageUrl ?? null,
      metaTitle: initialValues?.metaTitle ?? '',
      metaDescription: initialValues?.metaDescription ?? '',
      publishedAt: initialValues?.publishedAt
        ? new Date(initialValues.publishedAt).toISOString().slice(0, 16)
        : '',
      isDraft: initialValues?.isDraft ?? true,
    },
  });

  const body = watch('body');
  const featuredImageUrl = watch('featuredImageUrl');

  const handleBodyChange = useCallback(
    (value: string) => {
      setValue('body', value);
    },
    [setValue],
  );

  const handleImageChange = useCallback(
    (url: string | null) => {
      setValue('featuredImageUrl', url);
    },
    [setValue],
  );

  const handleSaveAsDraft = useCallback(() => {
    setValue('isDraft', true);
    handleSubmit(onSubmit)();
  }, [setValue, handleSubmit, onSubmit]);

  const handlePublish = useCallback(() => {
    setValue('isDraft', false);
    handleSubmit(onSubmit)();
  }, [setValue, handleSubmit, onSubmit]);

  return (
    <form className={cn('space-y-6', className)} onSubmit={handleSubmit(onSubmit)}>
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">{t('admin.journal.form.title')}</Label>
        <Input
          id="title"
          {...register('title')}
          placeholder={t('admin.journal.form.titlePlaceholder')}
          className={cn(errors.title && 'border-red-500 focus-visible:ring-red-500')}
        />
        {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug">{t('admin.journal.form.slug')}</Label>
        <Input
          id="slug"
          {...register('slug')}
          placeholder={t('admin.journal.form.slugPlaceholder')}
        />
      </div>

      {/* Type */}
      <div className="space-y-2">
        <Label>{t('admin.journal.form.type')}</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPE_VALUES.map((postType) => (
                  <SelectItem key={postType} value={postType}>
                    {t(`journal.postTypes.${postType}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Featured Image */}
      <div className="space-y-2">
        <Label>{t('admin.journal.form.featuredImage')}</Label>
        <ImageUploader value={featuredImageUrl} onChange={handleImageChange} />
      </div>

      {/* Body */}
      <div className="space-y-2">
        <Label>{t('admin.journal.form.body')}</Label>
        <MarkdownEditor
          value={body}
          onChange={handleBodyChange}
          placeholder={t('admin.journal.form.bodyPlaceholder')}
        />
        {errors.body && <p className="text-xs text-red-400">{errors.body.message}</p>}
      </div>

      {/* SEO Fields */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium text-muted-foreground">SEO</h3>

        <div className="space-y-2">
          <Label htmlFor="metaTitle">{t('admin.journal.form.metaTitle')}</Label>
          <Input
            id="metaTitle"
            {...register('metaTitle')}
            placeholder={t('admin.journal.form.metaTitlePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="metaDescription">{t('admin.journal.form.metaDescription')}</Label>
          <Input
            id="metaDescription"
            {...register('metaDescription')}
            placeholder={t('admin.journal.form.metaDescriptionPlaceholder')}
          />
        </div>
      </div>

      {/* Publish Date */}
      <div className="space-y-2">
        <Label htmlFor="publishedAt">{t('admin.journal.form.publishedAt')}</Label>
        <Input id="publishedAt" type="datetime-local" {...register('publishedAt')} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4">
        <Button type="button" variant="outline" onClick={handleSaveAsDraft} disabled={isLoading}>
          {t('admin.journal.form.saveAsDraft')}
        </Button>
        <Button type="button" onClick={handlePublish} disabled={isLoading}>
          {isLoading ? t('admin.journal.form.saving') : t('admin.journal.form.publish')}
        </Button>
      </div>
    </form>
  );
}
