'use client';

/**
 * Admin new journal post page.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { useTranslation } from '@/shared/i18n';
import { toast } from 'sonner';

import { useCreatePost, PostForm, type PostFormValues } from '@/modules/journal';

export default function NewJournalPostPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const createPostMutation = useCreatePost();

  const handleSubmit = useCallback(
    async (values: PostFormValues) => {
      try {
        const result = await createPostMutation.mutateAsync({
          title: values.title,
          slug: values.slug || undefined,
          type: values.type,
          body: values.body,
          featuredImageUrl: values.featuredImageUrl || undefined,
          metaTitle: values.metaTitle || undefined,
          metaDescription: values.metaDescription || undefined,
          publishedAt: values.publishedAt || undefined,
          isDraft: values.isDraft,
        });

        toast.success(values.isDraft ? 'Чернетку збережено' : 'Публікацію створено');
        router.push(`/admin/journal/${result.id}`);
      } catch {
        toast.error('Помилка при створенні');
      }
    },
    [createPostMutation, router],
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.journal.newPost')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PostForm onSubmit={handleSubmit} isLoading={createPostMutation.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}
