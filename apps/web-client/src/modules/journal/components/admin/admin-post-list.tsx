'use client';

/**
 * Admin post list with status indicators and actions.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Pencil, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';

import { useTranslation } from '@/shared/i18n';
import { DataTable } from '@/modules/admin/components/ui/DataTable';
import type { DataTableColumnDef, DropdownMenuItemProps } from '@/modules/admin/types';

import type { AdminJournalPost } from '../../types';
import { PostStatusBadge } from './post-status-badge';
import { PostTypeBadge } from '../post-type-badge';

export interface AdminPostListProps {
  posts: AdminJournalPost[];
  isLoading?: boolean;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
  onPaginationChange?: (pagination: { page: number; limit: number }) => void;
  onDelete?: (post: AdminJournalPost) => void;
  onPublish?: (post: AdminJournalPost) => void;
  onUnpublish?: (post: AdminJournalPost) => void;
}

/**
 * Formats date for display.
 */
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Admin post list with DataTable.
 */
export function AdminPostList({
  posts,
  isLoading,
  error,
  pagination,
  onPaginationChange,
  onDelete,
  onPublish,
  onUnpublish,
}: AdminPostListProps) {
  const { t, locale } = useTranslation();
  const router = useRouter();

  const handleEdit = useCallback(
    (post: AdminJournalPost) => {
      router.push(`/admin/journal/${post.id}` as Route);
    },
    [router],
  );

  const columns: DataTableColumnDef<AdminJournalPost>[] = [
    {
      id: 'title',
      header: t('admin.journal.columns.title'),
      accessorKey: 'title',
      cell: ({ row }) => (
        <div className="font-medium max-w-[300px] truncate">{row.original.title}</div>
      ),
    },
    {
      id: 'type',
      header: t('admin.journal.columns.type'),
      accessorKey: 'type',
      cell: ({ row }) => <PostTypeBadge type={row.original.type} />,
      width: '140px',
    },
    {
      id: 'status',
      header: t('admin.journal.columns.status'),
      accessorKey: 'isDraft',
      cell: ({ row }) => <PostStatusBadge post={row.original} />,
      width: '120px',
    },
    {
      id: 'publishedAt',
      header: t('admin.journal.columns.publishedAt'),
      accessorKey: 'publishedAt',
      cell: ({ row }) =>
        row.original.publishedAt ? (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.publishedAt, locale)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      width: '180px',
    },
  ];

  const handleView = useCallback((post: AdminJournalPost) => {
    window.open(`/journal/${post.slug}`, '_blank');
  }, []);

  const rowActions = useCallback(
    (post: AdminJournalPost): DropdownMenuItemProps[] => {
      const actions: DropdownMenuItemProps[] = [
        {
          label: t('admin.journal.actions.edit'),
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => handleEdit(post),
        },
      ];

      // Add view action for published posts
      if (!post.isDraft) {
        actions.push({
          label: t('admin.journal.actions.view'),
          icon: <ExternalLink className="w-4 h-4" />,
          onClick: () => handleView(post),
        });
      }

      if (post.isDraft) {
        if (onPublish) {
          actions.push({
            label: t('admin.journal.actions.publish'),
            icon: <Eye className="w-4 h-4" />,
            onClick: () => onPublish(post),
          });
        }
      } else {
        if (onUnpublish) {
          actions.push({
            label: t('admin.journal.actions.unpublish'),
            icon: <EyeOff className="w-4 h-4" />,
            onClick: () => onUnpublish(post),
          });
        }
      }

      if (onDelete) {
        actions.push({
          label: t('admin.journal.actions.delete'),
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => onDelete(post),
          variant: 'destructive',
        });
      }

      return actions;
    },
    [t, handleEdit, handleView, onPublish, onUnpublish, onDelete],
  );

  return (
    <DataTable
      data={posts}
      columns={columns}
      loading={isLoading}
      error={error}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      rowActions={rowActions}
      emptyState={
        <div className="text-muted-foreground">{t('admin.journal.empty')}</div>
      }
    />
  );
}
