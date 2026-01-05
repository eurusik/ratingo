'use client';

import { useState } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { DataTable } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { MappingDialog, type MappingFormData } from './MappingDialog';
import { useUnmappedProviders, useCreateMapping } from '@/core/query';
import type { DataTableColumnDef } from '../../types';
import type { UnmappedProvider, DistributionChannel } from '@/core/api/admin-providers';
import { toast } from 'sonner';

interface UnmappedProvidersTableProps {
  labels?: {
    title?: string;
    description?: string;
    createMapping?: string;
    columns?: {
      tmdbId?: string;
      name?: string;
      region?: string;
      occurrences?: string;
      lastSeen?: string;
    };
    empty?: {
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
      success?: string;
      error?: string;
    };
  };
}

/**
 * Table showing unmapped TMDB providers.
 * Allows creating mappings directly from the table.
 */
export function UnmappedProvidersTable({ labels }: UnmappedProvidersTableProps) {
  const [page, setPage] = useState(1);
  const [mappingDialog, setMappingDialog] = useState<{
    open: boolean;
    provider?: UnmappedProvider;
  }>({ open: false });

  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, isLoading, error } = useUnmappedProviders({ limit, offset });
  const createMappingMutation = useCreateMapping();

  const columns: DataTableColumnDef<UnmappedProvider>[] = [
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
      id: 'lastSeenName',
      header: labels?.columns?.name ?? 'Name',
      accessorKey: 'lastSeenName',
      cell: ({ row }) => <span className="font-medium">{row.original.lastSeenName}</span>,
    },
    {
      id: 'sampleRegions',
      header: labels?.columns?.region ?? 'Regions',
      accessorKey: 'sampleRegions',
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.sampleRegions.slice(0, 3).map((region) => (
            <Badge key={region} variant="secondary" className="font-mono text-xs">
              {region}
            </Badge>
          ))}
          {row.original.sampleRegions.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{row.original.sampleRegions.length - 3}
            </Badge>
          )}
        </div>
      ),
      width: '120px',
    },
    {
      id: 'seenCount',
      header: labels?.columns?.occurrences ?? 'Seen',
      accessorKey: 'seenCount',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.seenCount.toLocaleString()}</span>
      ),
      width: '100px',
    },
    {
      id: 'lastSeenAt',
      header: labels?.columns?.lastSeen ?? 'Last seen',
      accessorKey: 'lastSeenAt',
      cell: ({ row }) => {
        const date = new Date(row.original.lastSeenAt);
        return (
          <span className="text-muted-foreground text-sm">
            {date.toLocaleDateString('uk-UA', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        );
      },
      width: '120px',
    },
  ];

  const handleCreateMapping = (provider: UnmappedProvider) => {
    setMappingDialog({ open: true, provider });
  };

  const handleSubmitMapping = async (formData: MappingFormData) => {
    try {
      await createMappingMutation.mutateAsync({
        tmdbProviderId: formData.tmdbProviderId,
        providerId: formData.providerId,
        variantId: formData.variantId || undefined,
        distributionChannel: (formData.distributionChannel || 'direct') as DistributionChannel,
        region: formData.region || 'global',
      });
      toast.success(labels?.toast?.success ?? 'Mapping created successfully');
    } catch {
      toast.error(labels?.toast?.error ?? 'Failed to create mapping');
      throw new Error('Failed to create mapping');
    }
  };

  const rowActions = (provider: UnmappedProvider) => [
    {
      label: labels?.createMapping ?? 'Create mapping',
      onClick: () => handleCreateMapping(provider),
      icon: <Plus className="h-4 w-4" />,
    },
  ];

  const emptyState = (
    <EmptyState
      icon={<AlertCircle className="h-12 w-12" />}
      title={labels?.empty?.title ?? 'All providers mapped'}
      description={labels?.empty?.description ?? 'No providers need mapping'}
    />
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            {labels?.title ?? 'Unmapped Providers'}
          </CardTitle>
          <CardDescription>
            {labels?.description ??
              'TMDB providers found in data that have no mapping to our canonical providers'}
          </CardDescription>
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
        onOpenChange={(open) => setMappingDialog({ open })}
        onSubmit={handleSubmitMapping}
        mode="create"
        initialData={
          mappingDialog.provider
            ? {
                tmdbProviderId: mappingDialog.provider.tmdbProviderId,
                tmdbProviderName: mappingDialog.provider.lastSeenName,
                region: mappingDialog.provider.sampleRegions[0] ?? '',
              }
            : undefined
        }
        labels={labels?.dialog}
      />
    </>
  );
}
