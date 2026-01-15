'use client';

/**
 * Admin edit journal post page.
 */

import { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { useTranslation } from '@/shared/i18n';
import { toast } from 'sonner';

import {
  useAdminJournalPost,
  useUpdatePost,
  PostForm,
  type PostFormValues,
} from '@/modules/journal';

export default function EditJournalPostPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const postId = params.id as string;

  const { data: post, isLoading, error } = useAdminJournalPost(postId);
  const updatePostMutation = useUpdatePost();

  const handleSubmit = useCallback(
    async (values: PostFormValues) => {
      try {
        await updatePostMutation.mutateAsync({
          id: postId,
          data: {
            title: values.title,
            slug: values.slug || undefined,
            type: values.type,
            body: values.body,
            featuredImageUrl: values.featuredImageUrl ?? undefined,
            metaTitle: values.metaTitle || undefined,
            metaDescription: values.metaDescription || undefined,
            publishedAt: values.publishedAt || undefined,
            isDraft: values.isDraft,
          },
        });

        toast.success('Зміни збережено');
      } catch {
        toast.error('Помилка при збереженні');
      }
    },
    [postId, updatePostMutation],
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Публікацію не знайдено</p>
        <Link href="/admin/journal">
          <Button variant="outline" className="mt-4">
            {t('admin.journal.title')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Link href="/admin/journal">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('admin.journal.title')}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.journal.editPost')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PostForm
            initialValues={post}
            onSubmit={handleSubmit}
            isLoading={updatePostMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
