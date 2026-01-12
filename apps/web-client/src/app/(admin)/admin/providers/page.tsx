'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { AlertCircle, Link2, Info } from 'lucide-react';
import { UnmappedProvidersTable, MappingsTable } from '@/modules/admin';
import { useUnmappedProviders, useMappings } from '@/core/query';
import { useTranslation } from '@/shared/i18n';

/**
 * Admin Providers Page.
 *
 * Manages provider mappings between TMDB providers and our canonical providers.
 * Two main sections:
 * 1. Unmapped - TMDB providers that need mapping
 * 2. Mappings - Existing mappings (CRUD)
 */
export default function ProvidersPage() {
  const [activeTab, setActiveTab] = useState('unmapped');
  const { dict } = useTranslation();

  // Fetch counts for badges
  const { data: unmappedData } = useUnmappedProviders({ limit: 1 });
  const { data: mappingsData } = useMappings({ limit: 1 });

  const unmappedCount = unmappedData?.meta?.total ?? 0;
  const mappingsCount = mappingsData?.meta?.total ?? 0;

  const labels = dict.admin?.providers ?? {};

  return (
    <div className="space-y-6">
      {/* Header with explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {labels.title ?? 'Provider Management'}
          </CardTitle>
          <CardDescription>
            {labels.description ?? 'Linking TMDB providers to our canonical providers'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>{labels.info?.whatIsMapping ?? 'What is a mapping?'}</strong>{' '}
                {labels.info?.whatIsMappingDescription ??
                  'TMDB returns providers with different IDs for different regions. Mapping allows us to unify them under one canonical provider.'}
              </p>
              <p>
                <strong>{labels.info?.example ?? 'Example:'}</strong>{' '}
                {labels.info?.exampleDescription ??
                  'TMDB ID 8 (Netflix US), TMDB ID 175 (Netflix UA) → canonical'}{' '}
                <code className="bg-muted px-1 rounded">netflix</code>
              </p>
              <p>
                <strong>{labels.info?.distributionChannel ?? 'Distribution Channel:'}</strong>{' '}
                {labels.info?.distributionChannelDescription ??
                  'Direct = own service, Amazon/Apple Channel = content available via Amazon Prime / Apple TV+ subscription'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="unmapped" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {labels.tabs?.unmapped ?? 'Unmapped'}
            {unmappedCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unmappedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mappings" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {labels.tabs?.mappings ?? 'Mappings'}
            <Badge variant="secondary" className="ml-1">
              {mappingsCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unmapped" className="mt-6">
          <UnmappedProvidersTable
            labels={{
              title: labels.unmapped?.title,
              description: labels.unmapped?.description,
              createMapping: labels.unmapped?.createMapping,
              columns: labels.unmapped?.columns,
              empty: labels.unmapped?.empty,
              dialog: labels.dialog,
              toast: {
                success: labels.toast?.createSuccess,
                error: labels.toast?.createError,
              },
            }}
          />
        </TabsContent>

        <TabsContent value="mappings" className="mt-6">
          <MappingsTable
            labels={{
              title: labels.mappings?.title,
              description: labels.mappings?.description,
              addMapping: labels.mappings?.addMapping,
              global: labels.mappings?.global,
              columns: labels.mappings?.columns,
              channels: labels.mappings?.channels,
              sources: labels.mappings?.sources,
              empty: labels.mappings?.empty,
              actions: labels.mappings?.actions,
              confirmDelete: labels.mappings?.confirmDelete,
              dialog: labels.dialog,
              toast: {
                createSuccess: labels.toast?.createSuccess,
                createError: labels.toast?.createError,
                updateSuccess: labels.toast?.updateSuccess,
                updateError: labels.toast?.updateError,
                deleteSuccess: labels.toast?.deleteSuccess,
                deleteError: labels.toast?.deleteError,
              },
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
