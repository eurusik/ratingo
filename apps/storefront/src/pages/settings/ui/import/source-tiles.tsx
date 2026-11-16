'use client';

import { Chip, Radio, RadioGroup } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import {
  IMPORT_SOURCES,
  UPCOMING_SOURCES,
  isImportSource,
  type ImportSource,
  type ListedSource,
} from '@/pages/settings/model/import/import-sources';
import { SourceMark } from './source-mark';

const TILE =
  'flex w-full min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[18px] border border-border bg-surface p-3.5 outline-none transition-colors data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[selected=true]:border-2 data-[selected=true]:border-accent data-[selected=true]:bg-accent/8 data-[disabled=true]:cursor-default data-[disabled=true]:opacity-55 [@media(hover:hover)]:data-[hovered=true]:bg-default';

function SourceTile({ source }: { source: ListedSource }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const isUpcoming = !isImportSource(source);

  return (
    <Radio value={source} isDisabled={isUpcoming} className="min-w-0 flex-1">
      <Radio.Content className={TILE}>
        <SourceMark source={source} className="size-10" />
        <span translate="no" className="min-w-0 flex-1 truncate text-[15px] font-bold">
          {copy.sources[source].name}
        </span>
        {isUpcoming ? (
          <Chip size="sm" className="font-bold">
            {copy.source.soon}
          </Chip>
        ) : null}
      </Radio.Content>
    </Radio>
  );
}

interface SourceTilesProps {
  labelId: string;
  value?: ImportSource;
  onChange: (source: ImportSource) => void;
}

export function SourceTiles({ labelId, value, onChange }: SourceTilesProps) {
  return (
    <RadioGroup
      aria-labelledby={labelId}
      orientation="horizontal"
      value={value ?? null}
      onChange={(next) => {
        if (isImportSource(next)) onChange(next);
      }}
      className="flex flex-row gap-2.5"
    >
      {[...IMPORT_SOURCES, ...UPCOMING_SOURCES].map((source) => (
        <SourceTile key={source} source={source} />
      ))}
    </RadioGroup>
  );
}
