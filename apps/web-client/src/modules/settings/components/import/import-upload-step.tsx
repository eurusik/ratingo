'use client';

import { ChevronLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { ImportDropzone } from './import-dropzone';
import type { FileState } from './types';

interface ImportUploadStepProps {
  ratingsFile: FileState;
  watchlistFile: FileState;
  isUploading: boolean;
  hasItems: boolean;
  onRatingsFile: (text: string, fileName: string) => void;
  onWatchlistFile: (text: string, fileName: string) => void;
  onClearRatings: () => void;
  onClearWatchlist: () => void;
  onBack: () => void;
  onContinue: () => void;
  labels: {
    ratingsFile: string;
    watchlistFile: string;
    dropHint: string;
    dragOver: string;
    recognized: string;
    skippedRows: string;
    clearFile: string;
    retryFile: string;
    maxSizeHint: string;
    howTo: string;
    howToSteps: string[];
    back: string;
    continue: string;
  };
}

export function ImportUploadStep({
  ratingsFile,
  watchlistFile,
  isUploading,
  hasItems,
  onRatingsFile,
  onWatchlistFile,
  onClearRatings,
  onClearWatchlist,
  onBack,
  onContinue,
  labels,
}: ImportUploadStepProps) {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="gap-1 -ml-2 text-cinema-text-muted hover:text-cinema-text-primary"
      >
        <ChevronLeft className="w-4 h-4" />
        {labels.back}
      </Button>

      {/* How to download collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-cinema-borderSoft bg-cinema-card px-4 py-3 text-sm text-cinema-text-primary hover:bg-cinema-elevated motion-safe:transition-colors"
          >
            <span>{labels.howTo}</span>
            <ChevronDown className="w-4 h-4 text-cinema-text-muted motion-safe:transition-transform [[data-state=open]>&]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="mt-2 rounded-md border border-cinema-borderSoft bg-cinema-card p-4 space-y-2">
            {labels.howToSteps.map((step: string, idx: number) => (
              <li key={idx} className="flex gap-2.5 text-sm text-cinema-text-muted">
                <span className="shrink-0 font-medium text-cinema-text-primary">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>

      {/* Two dropzones grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ImportDropzone
          label={labels.ratingsFile}
          accept=".csv,text/csv"
          onFile={onRatingsFile}
          onClear={onClearRatings}
          status={ratingsFile.status}
          fileName={ratingsFile.fileName}
          itemCount={ratingsFile.itemCount}
          skippedCount={ratingsFile.skippedCount}
          errorMessage={ratingsFile.errorMessage}
          disabled={isUploading}
          recognizedLabel={labels.recognized}
          skippedLabel={labels.skippedRows}
          dropHint={labels.dropHint}
          clearLabel={labels.clearFile}
          retryLabel={labels.retryFile}
          dragOverHint={labels.dragOver}
          maxSizeHint={labels.maxSizeHint}
        />
        <ImportDropzone
          label={labels.watchlistFile}
          accept=".csv,text/csv"
          onFile={onWatchlistFile}
          onClear={onClearWatchlist}
          status={watchlistFile.status}
          fileName={watchlistFile.fileName}
          itemCount={watchlistFile.itemCount}
          skippedCount={watchlistFile.skippedCount}
          errorMessage={watchlistFile.errorMessage}
          disabled={isUploading}
          recognizedLabel={labels.recognized}
          skippedLabel={labels.skippedRows}
          dropHint={labels.dropHint}
          clearLabel={labels.clearFile}
          retryLabel={labels.retryFile}
          dragOverHint={labels.dragOver}
          maxSizeHint={labels.maxSizeHint}
        />
      </div>

      {/* Continue button */}
      <Button className="w-full" disabled={!hasItems} onClick={onContinue}>
        {labels.continue}
      </Button>
    </div>
  );
}
