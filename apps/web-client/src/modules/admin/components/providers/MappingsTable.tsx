'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmActionDialog } from '../dialogs/ConfirmActionDialog';
import { MappingDialog, type MappingFormData } from './MappingDialog';
import { useMappings, useCreateMapping, useUpdateMapping, useDeleteMapping } from '@/core/query';
import type { DataTableColumnDef } from '../../types';
import type { ProviderMapping, DistributionChannel } from '@/core/api/admin-providers';
import { toast } from 'sonner';

/** Distribution channel badge variant. */
const getChannelBadgeVariant = (channel: string) => {
  switch (channel) {
    case 'direct':
      return 'default';
    case 'amazon_channel':
      return 'secondary';
    case 'apple_tv_channel':
      return 'outline';
    default:
      return 'secondary';
  }
};

/** Distribution channel display name. */
const getChannelDisplayName = (
  channel: string,
  channelLabels?: { direct?: string; amazon?: string; appleTV?: string },
) => {
  switch (channel) {
    case 'direct':
      return channelLabels?.direct ?? 'Direct';
    case 'amazon_channel':
      return channelLabels?.amazon ?? 'Amazon';
    case 'apple_tv_channel':
      return channelLabels?.appleTV ?? 'Apple TV';
    default:
      return channel;
  }
};

/** Source display name. */
const getSourceDisplayName = (
  source: string,
  sourceLabels?: { manual?: string; auto?: string },
) => {
  switch (source) {
    case 'manual':
      return sourceLabels?.manual ?? 'manual';
    case 'auto':
      return sourceLabels?.auto ?? 'auto';
    default:
      return source;
  }
};

interface MappingsTableProps {
  labels?: {
    title?: string;
    description?: string;
    addMapping?: string;
    columns?: {
      tmdbId?: string;
      provider?: string;
      variant?: string;
      channel?: string;
      region?: string;
      source?: string;
    };
    channels?: {
      direct?: string;
      amazon?: string;
      appleTV?: string;
    };
    sources?: {
      manual?: string;
      auto?: string;
    };
    global?: string;
    empty?: {
      title?: string;
      description?: string;
      action?: string;
    };
    actions?: {
      edit?: string;
      delete?: string;
    };
    confirmDelete?: {
      title?: string;
      description?: string;
    };
    dialog?: {
      createTitle?: string;
      editTitle?: string;
      description?: string;
      tmdbProviderId?: string;
      tmdbProviderIdPlaceholder?: string;
      tmdbName?: string;
      providerId?: string;
      providerIdPlaceholder?: string;
      providerIdHint?: string;
      variantId?: string;
      variantIdPlaceholder?: string;
      variantIdHint?: string;
      distributionChannel?: string;
      distributionChannelHint?: string;
      channels?: {
        direct?: string;
        amazon?: string;
        appleTV?: string;
      };
      region?: string;
      regionPlaceholder?: string;
      regionHint?: string;
      cancel?: string;
      create?: string;
      save?: string;
      saving?: string;
      mediaCount?: string;
    };
    toast?: {
      createSuccess?: string;
      createError?: string;
      updateSuccess?: string;
      updateError?: string;
      deleteSuccess?: string;
      deleteError?: string;
    };
  };
}

/**
 * Table showing existing provider mappings.
 * Supports CRUD operations.
 */
export function MappingsTable({ labels }: MappingsTableProps) {
  const [page, setPage] = useState(1);
  const [mappingDialog, setMappingDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    mapping?: ProviderMapping;
  }>({ open: false, mode: 'create' });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    mapping?: ProviderMapping;
  }>({ open: false });

  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, isLoading, error } = useMappings({ limit, offset });
  const createMappingMutation = useCreateMapping();
  const updateMappingMutation = useUpdateMapping();
  const deleteMappingMutation = useDeleteMapping();

  const columns: DataTableColumnDef<ProviderMapping>[] = [
    {
      id: 'tmdbProviderId',
      header: labels?.columns?.tmdbId ?? 'TMDB ID',
      accessorKey: 'tmdbProviderId',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.tmdbProviderId}
        </Badge>
      ),
      width: '100px',
    },
    {
      id: 'providerId',
      header: labels?.columns?.provider ?? 'Provider',
      accessorKey: 'providerId',
      cell: ({ row }) => <span className="font-medium">{row.original.providerId}</span>,
    },
    {
      id: 'variantId',
      header: labels?.columns?.variant ?? 'Variant',
      accessorKey: 'variantId',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.variantId}</span>
      ),
    },
    {
      id: 'distributionChannel',
      header: labels?.columns?.channel ?? 'Channel',
      accessorKey: 'distributionChannel',
      cell: ({ row }) => (
        <Badge variant={getChannelBadgeVariant(row.original.distributionChannel)}>
          {getChannelDisplayName(row.original.distributionChannel, labels?.channels)}
        </Badge>
      ),
      width: '100px',
    },
    {
      id: 'region',
      header: labels?.columns?.region ?? 'Region',
      accessorKey: 'region',
      cell: ({ row }) =>
        row.original.region && row.original.region !== 'global' ? (
          <Badge variant="secondary" className="font-mono">
            {row.original.region.toUpperCase()}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{labels?.global ?? 'Global'}</span>
        ),
      width: '80px',
    },
    {
      id: 'source',
      header: labels?.columns?.source ?? 'Source',
      accessorKey: 'source',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {getSourceDisplayName(row.original.source, labels?.sources)}
        </span>
      ),
      width: '80px',
    },
  ];

  const handleCreateMapping = () => {
    setMappingDialog({ open: true, mode: 'create' });
  };

  const handleEditMapping = (mapping: ProviderMapping) => {
    setMappingDialog({ open: true, mode: 'edit', mapping });
  };

  const handleDeleteMapping = (mapping: ProviderMapping) => {
    setDeleteDialog({ open: true, mapping });
  };

  const handleSubmitMapping = async (formData: MappingFormData) => {
    try {
      if (mappingDialog.mode === 'create') {
        await createMappingMutation.mutateAsync({
          tmdbProviderId: formData.tmdbProviderId,
          providerId: formData.providerId,
          variantId: formData.variantId || undefined,
          distributionChannel: (formData.distributionChannel || 'direct') as DistributionChannel,
          region: formData.region || 'global',
        });
        toast.success(labels?.toast?.createSuccess ?? 'Mapping created');
      } else if (mappingDialog.mapping) {
        await updateMappingMutation.mutateAsync({
          id: mappingDialog.mapping.id,
          data: {
            providerId: formData.providerId,
            variantId: formData.variantId || undefined,
            distributionChannel: formData.distributionChannel
              ? (formData.distributionChannel as DistributionChannel)
              : undefined,
          },
        });
        toast.success(labels?.toast?.updateSuccess ?? 'Mapping updated');
      }
    } catch {
      toast.error(
        mappingDialog.mode === 'create'
          ? (labels?.toast?.createError ?? 'Failed to create mapping')
          : (labels?.toast?.updateError ?? 'Failed to update mapping'),
      );
      throw new Error('Failed to save mapping');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.mapping) return;
    try {
      await deleteMappingMutation.mutateAsync(deleteDialog.mapping.id);
      toast.success(labels?.toast?.deleteSuccess ?? 'Mapping deleted');
      setDeleteDialog({ open: false });
    } catch {
      toast.error(labels?.toast?.deleteError ?? 'Failed to delete mapping');
    }
  };

  const rowActions = (mapping: ProviderMapping) => [
    {
      label: labels?.actions?.edit ?? 'Edit',
      onClick: () => handleEditMapping(mapping),
      icon: <Pencil className="h-4 w-4" />,
    },
    {
      label: labels?.actions?.delete ?? 'Delete',
      onClick: () => handleDeleteMapping(mapping),
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive' as const,
    },
  ];

  const emptyState = (
    <EmptyState
      icon={<Link2 className="h-12 w-12" />}
      title={labels?.empty?.title ?? 'No mappings'}
      description={labels?.empty?.description ?? 'Create your first provider mapping'}
      action={{
        label: labels?.empty?.action ?? 'Create mapping',
        onClick: handleCreateMapping,
      }}
    />
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {labels?.title ?? 'Provider Mappings'}
            </CardTitle>
            <CardDescription>
              {labels?.description ??
                'Links between TMDB providers and our canonical providers'}
            </CardDescription>
          </div>
          <Button onClick={handleCreateMapping}>
            <Plus className="h-4 w-4 mr-2" />
            {labels?.addMapping ?? 'Add mapping'}
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            data={data?.data ?? []}
            columns={columns}
            loading={isLoading}
            error={error?.message}
            rowActions={rowActions}
            emptyState={emptyState}
            pagination={data?.meta ? {
              page,
              limit,
              total: data.meta.total ?? 0,
              hasNext: data.meta.hasMore ?? false,
            } : undefined}
            onPaginationChange={({ page: newPage }) => setPage(newPage)}
          />
        </CardContent>
      </Card>

      <MappingDialog
        open={mappingDialog.open}
        onOpenChange={(open) => setMappingDialog((prev) => ({ ...prev, open }))}
        onSubmit={handleSubmitMapping}
        mode={mappingDialog.mode}
        initialData={
          mappingDialog.mapping
            ? {
                tmdbProviderId: mappingDialog.mapping.tmdbProviderId,
                providerId: mappingDialog.mapping.providerId,
                variantId: mappingDialog.mapping.variantId ?? '',
                distributionChannel: mappingDialog.mapping.distributionChannel,
                region: mappingDialog.mapping.region ?? '',
              }
            : undefined
        }
        labels={labels?.dialog}
      />

      <ConfirmActionDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open })}
        title={labels?.confirmDelete?.title ?? 'Delete mapping'}
        description={
          labels?.confirmDelete?.description ??
          `Are you sure you want to delete mapping for TMDB ID ${deleteDialog.mapping?.tmdbProviderId}?`
        }
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </>
  );
}
