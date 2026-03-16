'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Switch } from '@/shared/ui/switch';
import { Label } from '@/shared/ui/label';
import { ImportPreviewTable } from './import-preview-table';
import { ImportConfirmDialog } from './import-confirm-dialog';
import type { ParsedItem } from '../../utils/csv-parsers';
import { formatNumber } from '../../utils/format-number';

const CONFIRM_THRESHOLD = 100;

interface ImportPreviewStepProps {
  ratings: ParsedItem[];
  watchlist: ParsedItem[];
  ratingsSkippedCount: number;
  watchlistSkippedCount: number;
  overwrite: boolean;
  isImporting: boolean;
  previewFilter: string;
  onFilterChange: (filter: string) => void;
  onToggleOverwrite: () => void;
  onBack: () => void;
  onImport: () => void;
  labels: {
    back: string;
    // Preview table labels
    summary: string;
    truncated: string;
    rating: string;
    watchlist: string;
    colTitle: string;
    colYear: string;
    colType: string;
    colRating: string;
    filterAll: string;
    filterRatings: string;
    filterWatchlist: string;
    skippedExplanation: string;
    // Overwrite
    overwrite: string;
    overwriteHint: string;
    // Import button
    importButton: string;
    importing: string;
    // Confirm dialog
    confirmImport: {
      title: string;
      message: string;
      overwriteWarning: string;
      confirm: string;
      cancel: string;
    };
  };
}

export function ImportPreviewStep({
  ratings,
  watchlist,
  ratingsSkippedCount,
  watchlistSkippedCount,
  overwrite,
  isImporting,
  previewFilter,
  onFilterChange,
  onToggleOverwrite,
  onBack,
  onImport,
  labels,
}: ImportPreviewStepProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const totalCount = ratings.length + watchlist.length;
  const importTriggered = useRef(false);

  // Reset the guard when isImporting transitions back to false so that a retry
  // after an error is allowed to proceed.
  useEffect(() => {
    if (!isImporting) importTriggered.current = false;
  }, [isImporting]);

  const handleImportClick = () => {
    if (importTriggered.current) return;
    if (totalCount > CONFIRM_THRESHOLD) {
      setConfirmOpen(true);
    } else {
      importTriggered.current = true;
      onImport();
    }
  };

  const handleConfirm = () => {
    if (importTriggered.current) return;
    importTriggered.current = true;
    setConfirmOpen(false);
    onImport();
  };

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={isImporting}
        className="gap-1 -ml-2 text-cinema-text-muted hover:text-cinema-text-primary"
      >
        <ChevronLeft className="w-4 h-4" />
        {labels.back}
      </Button>

      <ImportPreviewTable
        ratings={ratings}
        watchlist={watchlist}
        filter={previewFilter}
        onFilterChange={onFilterChange}
        ratingsSkippedCount={ratingsSkippedCount}
        watchlistSkippedCount={watchlistSkippedCount}
        labels={{
          summary: labels.summary,
          truncated: labels.truncated,
          rating: labels.rating,
          watchlist: labels.watchlist,
          colTitle: labels.colTitle,
          colYear: labels.colYear,
          colType: labels.colType,
          colRating: labels.colRating,
          filterAll: labels.filterAll,
          filterRatings: labels.filterRatings,
          filterWatchlist: labels.filterWatchlist,
          skippedExplanation: labels.skippedExplanation,
        }}
      />

      {/* Overwrite toggle — prominent */}
      <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <Switch
          id="overwrite-toggle"
          checked={overwrite}
          onCheckedChange={onToggleOverwrite}
          disabled={isImporting}
        />
        <div>
          <Label htmlFor="overwrite-toggle" className="text-cinema-text-primary cursor-pointer">
            {labels.overwrite}
          </Label>
          <p className="text-xs text-cinema-text-muted mt-0.5">{labels.overwriteHint}</p>
        </div>
      </div>

      {/* Import button */}
      <Button
        className="w-full"
        disabled={isImporting || totalCount === 0}
        onClick={handleImportClick}
        aria-busy={isImporting || undefined}
      >
        {isImporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {labels.importing}
          </>
        ) : (
          labels.importButton.replace('{count}', formatNumber(totalCount))
        )}
      </Button>

      <ImportConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirm}
        itemCount={totalCount}
        overwrite={overwrite}
        labels={labels.confirmImport}
      />
    </div>
  );
}
