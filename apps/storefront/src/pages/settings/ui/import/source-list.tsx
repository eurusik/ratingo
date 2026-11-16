'use client';

import { Button, Chip } from '@heroui/react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import {
  IMPORT_SOURCES,
  UPCOMING_SOURCES,
  type ImportSource,
  type ListedSource,
} from '@/pages/settings/model/import/import-sources';
import { CARD_LIST } from '../settings-card';
import { SourceMark } from './source-mark';

type SourceRowProps =
  | { source: ImportSource; isUpcoming: false; onPick: () => void }
  | { source: ListedSource; isUpcoming: true; onPick?: never };

function SourceRow({ source, isUpcoming, onPick }: SourceRowProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;

  return (
    <Button
      variant="ghost"
      fullWidth
      isDisabled={isUpcoming}
      onPress={onPick}
      className="h-auto min-h-17 justify-start gap-3.5 rounded-none bg-transparent px-0 py-2.5 text-start text-foreground data-[disabled=true]:opacity-55"
    >
      <SourceMark source={source} className="size-11" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span translate="no" className="text-base font-semibold">
          {copy.sources[source].name}
        </span>
        <span className="truncate text-[13px] font-normal text-muted">
          {copy.sources[source].desc}
        </span>
      </span>
      {isUpcoming ? (
        <Chip size="sm" className="font-bold">
          {copy.source.soon}
        </Chip>
      ) : (
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      )}
    </Button>
  );
}

export function SourceList({ onPick }: { onPick: (source: ImportSource) => void }) {
  return (
    <ul className={CARD_LIST}>
      {IMPORT_SOURCES.map((source) => (
        <li key={source}>
          <SourceRow source={source} isUpcoming={false} onPick={() => onPick(source)} />
        </li>
      ))}
      {UPCOMING_SOURCES.map((source) => (
        <li key={source}>
          <SourceRow source={source} isUpcoming />
        </li>
      ))}
    </ul>
  );
}
