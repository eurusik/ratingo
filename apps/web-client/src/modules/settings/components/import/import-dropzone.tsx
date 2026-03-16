'use client';

import { useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { CheckCircle, XCircle, Upload, X } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';

export interface ImportDropzoneProps {
  label: string;
  accept: string;
  onFile: (text: string, fileName: string) => void;
  onClear: () => void;
  status: 'idle' | 'loaded' | 'error';
  fileName?: string;
  itemCount?: number;
  skippedCount?: number;
  errorMessage?: string;
  disabled?: boolean;
  recognizedLabel?: string;
  skippedLabel?: string;
  dropHint?: string;
  clearLabel?: string;
  retryLabel?: string;
  dragOverHint?: string;
  maxSizeHint?: string;
}

/** Sentinel value emitted when the selected file exceeds the size limit. */
export const FILE_TOO_LARGE_SENTINEL = '__TOO_LARGE__';

/** Text encoding used when reading CSV files. */
const FILE_ENCODING = 'utf-8';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function ImportDropzone({
  label,
  accept,
  onFile,
  onClear,
  status,
  fileName,
  itemCount,
  skippedCount,
  errorMessage,
  disabled = false,
  recognizedLabel = '{count} recognized',
  skippedLabel = '{count} rows skipped',
  dropHint = 'Drag & drop or click to select',
  clearLabel = 'Clear file',
  retryLabel = 'Try again',
  dragOverHint = 'Drop to upload',
  maxSizeHint,
}: ImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const readFile = useCallback(
    (file: File) => {
      if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
        onFile('', file.name); // trigger error via parent
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        onFile(FILE_TOO_LARGE_SENTINEL, file.name);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onFile(text, file.name);
      };
      reader.onerror = () => {
        onFile('', file.name);
      };
      reader.readAsText(file, FILE_ENCODING);
    },
    [onFile],
  );

  const handleClick = () => {
    if (!disabled && status !== 'loaded') {
      inputRef.current?.click();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && status !== 'loaded') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const isError = status === 'error';
  const isLoaded = status === 'loaded';

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        'min-h-[140px] cursor-pointer select-none',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        isLoaded
          ? 'border-green-500/60 bg-green-500/5 cursor-default'
          : isError
            ? 'border-red-500/60 bg-red-500/5'
            : isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-cinema-border bg-cinema-card hover:border-primary/60 hover:bg-cinema-elevated/50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {isLoaded ? (
        <>
          <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-cinema-text-primary truncate max-w-[180px]">
              {fileName}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {itemCount !== undefined && itemCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {recognizedLabel.replace('{count}', itemCount.toLocaleString('uk'))}
                </Badge>
              )}
              {skippedCount !== undefined && skippedCount > 0 && (
                <Badge variant="outline" className="text-xs text-cinema-text-muted">
                  {skippedLabel.replace('{count}', skippedCount.toLocaleString('uk'))}
                </Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label={clearLabel}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute top-2 right-2 rounded-full p-0.5 text-cinema-text-muted hover:text-cinema-text-primary hover:bg-cinema-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : isError ? (
        <>
          <XCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-cinema-text-primary">{label}</p>
            {errorMessage && (
              <p className="text-xs text-red-400 max-w-[200px]">{errorMessage}</p>
            )}
          </div>
          <button
            type="button"
            aria-label={retryLabel}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute top-2 right-2 rounded-full p-0.5 text-cinema-text-muted hover:text-cinema-text-primary hover:bg-cinema-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <Upload
            className={[
              'w-8 h-8 shrink-0',
              isDragOver ? 'text-primary' : 'text-cinema-text-muted',
            ].join(' ')}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-cinema-text-primary">{label}</p>
            <p className="text-xs text-cinema-text-muted">
              {isDragOver ? dragOverHint : dropHint}
            </p>
            {maxSizeHint && (
              <p className="text-xs text-cinema-text-disabled mt-0.5">{maxSizeHint}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
