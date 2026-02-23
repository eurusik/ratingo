'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Database, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmActionDialog } from '@/modules/admin';
import { useBackfillAltTitles } from '@/core/query';
import { useTranslation } from '@/shared/i18n';

export default function BackfillPage() {
  const [altTitlesDialogOpen, setAltTitlesDialogOpen] = useState(false);
  const backfillAltTitlesMutation = useBackfillAltTitles();
  const { dict } = useTranslation();

  const labels = dict.admin?.backfill ?? {};
  const altTitles = labels.altTitles ?? {};

  const handleBackfillAltTitles = async () => {
    try {
      const result = await backfillAltTitlesMutation.mutateAsync({ force: true });
      const msg = altTitles.success
        ? altTitles.success.replace('{jobId}', result.jobId)
        : `Alt titles backfill queued (jobId: ${result.jobId})`;
      toast.success(msg);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (altTitles.error ?? 'Failed to queue alt titles backfill'),
      );
    } finally {
      setAltTitlesDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {labels.title ?? 'Backfill Operations'}
          </CardTitle>
          <CardDescription>
            {labels.description ?? 'One-time data backfill jobs for media metadata enrichment.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {altTitles.title ?? 'Alternative Titles'}
              </p>
              <p className="text-sm text-muted-foreground">
                {altTitles.description ??
                  'Fetch missing alternative titles from TMDB for all media items. Uses lightweight TMDB endpoints only.'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setAltTitlesDialogOpen(true)}
              disabled={backfillAltTitlesMutation.isPending}
            >
              <Languages className="h-4 w-4 mr-2" />
              {altTitles.button ?? 'Run Backfill'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={altTitlesDialogOpen}
        onOpenChange={setAltTitlesDialogOpen}
        title={altTitles.confirmTitle ?? 'Backfill Alternative Titles'}
        description={altTitles.confirmDescription ??
          'This will queue a background job to fetch missing alternative titles from TMDB for all media items. The job runs with force=true, bypassing daily dedup. Continue?'}
        confirmText={altTitles.confirmButton ?? 'Run Backfill'}
        onConfirm={handleBackfillAltTitles}
      />
    </div>
  );
}
