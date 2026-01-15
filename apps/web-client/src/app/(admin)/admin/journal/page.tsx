'use client';

/**
 * Admin journal list page.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { useTranslation } from '@/shared/i18n';
import { toast } from 'sonner';

import {
  useAdminJournalPosts,
  useDeletePost,
  usePublishPost,
  useUnpublishPost,
  AdminPostList,
  type AdminJournalPost,
} from '@/modules/journal';

export default function AdminJournalPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    post?: AdminJournalPost;
  }>({ open: false });

  const { data, isLoading, error } = useAdminJournalPosts();
  const deletePostMutation = useDeletePost();
  const publishPostMutation = usePublishPost();
  const unpublishPostMutation = useUnpublishPost();

  const handleNewPost = useCallback(() => {
    router.push('/admin/journal/new');
  }, [router]);

  const handleDelete = useCallback((post: AdminJournalPost) => {
    setDeleteDialog({ open: true, post });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog.post) return;

    try {
      await deletePostMutation.mutateAsync(deleteDialog.post.id);
      toast.success('Публікацію видалено');
      setDeleteDialog({ open: false });
    } catch {
      toast.error('Помилка при видаленні');
    }
  }, [deleteDialog.post, deletePostMutation]);

  const handlePublish = useCallback(
    async (post: AdminJournalPost) => {
      try {
        await publishPostMutation.mutateAsync(post.id);
        toast.success('Публікацію опубліковано');
      } catch {
        toast.error('Помилка при публікації');
      }
    },
    [publishPostMutation],
  );

  const handleUnpublish = useCallback(
    async (post: AdminJournalPost) => {
      try {
        await unpublishPostMutation.mutateAsync(post.id);
        toast.success('Публікацію знято з публікації');
      } catch {
        toast.error('Помилка');
      }
    },
    [unpublishPostMutation],
  );

  const pagination = data
    ? {
        page: data.meta.page,
        limit: data.meta.limit,
        total: data.meta.total,
        hasNext: data.meta.page < data.meta.totalPages,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{t('admin.journal.title')}</CardTitle>
          </div>
          <Button onClick={handleNewPost}>
            <Plus className="h-4 w-4 mr-2" />
            {t('admin.journal.newPost')}
          </Button>
        </CardHeader>
        <CardContent>
          <AdminPostList
            posts={data?.posts ?? []}
            isLoading={isLoading}
            error={error?.message}
            pagination={pagination}
            onDelete={handleDelete}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.journal.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.journal.deleteConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.journal.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('admin.journal.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
