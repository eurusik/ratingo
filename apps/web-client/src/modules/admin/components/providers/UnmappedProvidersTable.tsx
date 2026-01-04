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
import type { UnmappedProvider } from '@/core/api/admin-providers';
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
      id: 'tmdbProviderName',
      header: labels?.columns?.name ?? 'Name',
      accessorKey: 'tmdbProviderName',
      cell: ({ row }) => <span className="font-medium">{row.original.tmdbProviderName}</span>,
    },
    {
      id: 'region',
      header: labels?.columns?.region ?? 'Region',
      accessorKey: 'region',
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono">
          {row.original.region}
        </Badge>
      ),
      width: '80px',
    },
    {
      id: 'occurrences',
      header: labels?.columns?.occurrences ?? 'Occurrences',
      accessorKey: 'occurrences',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.occurrences.toLocaleString()}</span>
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
        distributionChannel: formData.distributionChannel || undefined,
        region: formData.region || undefined,
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
            pagination={data?.meta && {
              page,
              limit,
              total: data.meta.total,
              hasNext: data.meta.hasMore,
            }}
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
                tmdbProviderName: mappingDialog.provider.tmdbProviderName,
                region: mappingDialog.provider.region,
              }
            : undefined
        }
      />
    </>
  );
}
