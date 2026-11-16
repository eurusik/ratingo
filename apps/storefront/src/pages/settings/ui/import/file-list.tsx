'use client';

import { Button } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { FileText, X } from 'lucide-react';
import { formatCount, interpolate, useTranslation } from '@/shared/i18n';
import type { ImportFile, ReadyFile } from '@/pages/settings/model/import/import-file';
import { CARD_LIST } from '../settings-card';

function useFileSummary() {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;
  const count = (forms: typeof copy.titles, value: number) => formatCount(value, forms, locale);

  return (file: ReadyFile) => {
    const flow =
      file.kind === 'ratings'
        ? interpolate(copy.files.toHistory, { count: count(copy.ratings, file.items.length) })
        : interpolate(copy.files.toPlan, { count: count(copy.titles, file.items.length) });
    if (file.skippedRows === 0) return flow;
    const skipped = interpolate(copy.files.skipped, { rows: count(copy.rows, file.skippedRows) });
    return `${flow} · ${skipped}`;
  };
}

interface FileListProps {
  files: readonly ImportFile[];
  sourceName: string;
  onRemove: (id: string) => void;
}

export function FileList({ files, sourceName, onRemove }: FileListProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.files;
  const summarize = useFileSummary();

  if (files.length === 0) return null;

  return (
    <ul aria-label={copy.listLabel} className={cn(CARD_LIST, 'md:px-4.5')}>
      {files.map((file) => {
        const isRejected = file.status === 'rejected';
        return (
          <li key={file.id} className="flex min-h-16 items-center gap-3 py-2.5 md:gap-3.5">
            <span
              aria-hidden
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-[10px]',
                isRejected ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success',
              )}
            >
              <FileText className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span translate="no" className="truncate text-[15px] font-semibold">
                {file.name}
              </span>
              {isRejected ? (
                <span role="alert" className="text-[13px] text-danger md:text-sm">
                  {interpolate(copy.problems[file.problem], { source: sourceName })}
                </span>
              ) : (
                <span className="text-[13px] text-muted md:text-sm">{summarize(file)}</span>
              )}
            </span>
            <Button
              isIconOnly
              variant="ghost"
              aria-label={interpolate(copy.remove, { name: file.name })}
              onPress={() => onRemove(file.id)}
              className="size-11 shrink-0 rounded-full text-muted"
            >
              <X aria-hidden className="size-4.5" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
