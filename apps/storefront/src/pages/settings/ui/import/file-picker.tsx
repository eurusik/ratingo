'use client';

import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { DropZone, isFileDropItem, type DropZoneProps } from 'react-aria-components';
import { cn } from '@ratingo/web-core/lib';
import { Upload } from 'lucide-react';
import { interpolateNodes, useTranslation } from '@/shared/i18n';

type DropEvent = Parameters<NonNullable<DropZoneProps['onDrop']>>[0];

const ACCEPTED_TYPES = '.csv,text/csv';

interface FilePickerProps {
  isDesktop: boolean;
  onFiles: (files: File[]) => void;
}

async function droppedFiles(event: DropEvent): Promise<File[]> {
  return Promise.all(event.items.filter(isFileDropItem).map((item) => item.getFile()));
}

function useFileInput(onFiles: (files: File[]) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };
  const input: ReactNode = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_TYPES}
      multiple
      hidden
      tabIndex={-1}
      onChange={onChange}
    />
  );
  return { input, open: () => inputRef.current?.click() };
}

export function FilePicker({ isDesktop, onFiles }: FilePickerProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.files;
  const fileInput = useFileInput(onFiles);

  if (!isDesktop) {
    return (
      <>
        {fileInput.input}
        <Button
          variant="ghost"
          fullWidth
          onPress={fileInput.open}
          className="h-auto min-h-24 flex-col gap-1.5 rounded-[20px] border-2 border-dashed border-border bg-transparent p-4"
        >
          <span className="text-base font-bold text-accent">{copy.pick}</span>
          <span className="text-[13px] font-normal text-muted">{copy.pickHint}</span>
        </Button>
      </>
    );
  }

  return (
    <DropZone
      aria-label={copy.drop}
      getDropOperation={() => 'copy'}
      onDrop={(event) => {
        droppedFiles(event).then(onFiles, (error: unknown) => {
          console.error('Reading dropped files failed', { error });
        });
      }}
      className={({ isDropTarget }) =>
        cn(
          'flex min-h-38 flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-border p-4.5 text-center transition-colors',
          isDropTarget && 'border-accent bg-accent/8',
        )
      }
    >
      {({ isDropTarget }) => (
        <>
          {fileInput.input}
          <Upload aria-hidden className="size-6 text-muted" />
          <b className="text-base">{isDropTarget ? copy.dropRelease : copy.drop}</b>
          <span className="text-sm text-muted">
            {interpolateNodes(copy.dropHint, {
              pick: (
                <Button
                  variant="ghost"
                  onPress={fileInput.open}
                  className="inline h-auto min-w-0 bg-transparent p-0 align-baseline text-sm font-semibold text-accent underline-offset-2 [@media(hover:hover)]:hover:underline"
                >
                  {copy.dropPick}
                </Button>
              ),
            })}
          </span>
        </>
      )}
    </DropZone>
  );
}
