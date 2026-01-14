'use client';

/**
 * Filter buttons for selecting post types.
 */

import { useCallback } from 'react';
import { Sparkles, BookOpen, Wrench, Map } from 'lucide-react';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils';

import { POST_TYPE_VALUES, type PostType } from '../types';

export interface PostTypeFilterProps {
  selected: PostType[];
  onChange: (types: PostType[]) => void;
  className?: string;
}

/**
 * Icon configuration for filter buttons.
 */
const FILTER_ICONS: Record<PostType, typeof Sparkles> = {
  update: Sparkles,
  explanation: BookOpen,
  fix: Wrench,
  roadmap: Map,
};

/**
 * Multi-select filter for post types.
 *
 * @example
 * const [types, setTypes] = useState<PostType[]>([]);
 * <PostTypeFilter selected={types} onChange={setTypes} />
 */
export function PostTypeFilter({ selected, onChange, className }: PostTypeFilterProps) {
  const { t } = useTranslation();

  const toggle = useCallback(
    (type: PostType) => {
      if (selected.includes(type)) {
        onChange(selected.filter((tp) => tp !== type));
      } else {
        onChange([...selected, type]);
      }
    },
    [selected, onChange],
  );

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const hasSelection = selected.length > 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {POST_TYPE_VALUES.map((type) => {
        const Icon = FILTER_ICONS[type];
        const isSelected = selected.includes(type);

        return (
          <Button
            key={type}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggle(type)}
            className={cn(
              'gap-1.5',
              isSelected && 'bg-primary/90',
            )}
          >
            <Icon className="w-4 h-4" />
            {t(`journal.postTypes.${type}`)}
          </Button>
        );
      })}
      {hasSelection && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-muted-foreground"
        >
          {t('journal.filter.reset')}
        </Button>
      )}
    </div>
  );
}
