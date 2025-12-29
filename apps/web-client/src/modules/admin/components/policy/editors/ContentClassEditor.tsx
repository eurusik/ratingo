"use client"

import { Filter } from 'lucide-react'
import { ConfigCard } from '../ConfigCard'
import { Badge } from '@/shared/ui/badge'
import type { ContentClass } from '@/core/api/admin'

// Re-export for convenience
export type { ContentClass }

interface ContentClassItem {
  value: ContentClass
  labelKey: string
  descriptionKey: string
}

// Only non-mainstream classes (mainstream should never be excluded)
const CONTENT_CLASSES: ContentClassItem[] = [
  { value: 'anime', labelKey: 'anime', descriptionKey: 'animeDescription' },
  { value: 'documentary', labelKey: 'documentary', descriptionKey: 'documentaryDescription' },
  { value: 'reality', labelKey: 'reality', descriptionKey: 'realityDescription' },
  { value: 'kids', labelKey: 'kids', descriptionKey: 'kidsDescription' },
]

const DEFAULT_LABELS: Record<string, string> = {
  anime: 'Anime',
  animeDescription: 'Japanese animation (JP origin + Animation genre)',
  documentary: 'Documentary',
  documentaryDescription: 'Documentary films and series',
  reality: 'Reality',
  realityDescription: 'Reality TV shows',
  kids: 'Kids',
  kidsDescription: 'Content for children',
}

interface ContentClassEditorProps {
  excludedContentClasses: ContentClass[]
  onChange: (value: ContentClass[]) => void
  labels?: {
    title?: string
    description?: string
    hint?: string
    toggleHint?: string
    anime?: string
    animeDescription?: string
    documentary?: string
    documentaryDescription?: string
    reality?: string
    realityDescription?: string
    kids?: string
    kidsDescription?: string
  }
}

/**
 * Editor for excluded content classes configuration.
 * 
 * Allows selecting which content classes to exclude from catalog.
 * Note: 'mainstream' is not shown as it should never be excluded.
 */
export function ContentClassEditor({
  excludedContentClasses,
  onChange,
  labels,
}: ContentClassEditorProps) {
  const handleToggle = (contentClass: ContentClass) => {
    if (excludedContentClasses.includes(contentClass)) {
      onChange(excludedContentClasses.filter((c) => c !== contentClass))
    } else {
      onChange([...excludedContentClasses, contentClass])
    }
  }

  const getLabel = (key: string) => labels?.[key as keyof typeof labels] ?? DEFAULT_LABELS[key] ?? key

  return (
    <ConfigCard
      title={labels?.title ?? 'Content Classes'}
      description={labels?.description ?? 'Exclude specific content types from catalog'}
      icon={Filter}
      contentClassName="space-y-3"
    >
      <div className="flex flex-wrap gap-2">
        {CONTENT_CLASSES.map((item) => {
          const isExcluded = excludedContentClasses.includes(item.value)
          return (
            <Badge
              key={item.value}
              variant={isExcluded ? 'destructive' : 'outline'}
              className="cursor-pointer hover:opacity-80 transition-opacity px-3 py-1.5"
              onClick={() => handleToggle(item.value)}
              title={getLabel(item.descriptionKey)}
            >
              {getLabel(item.labelKey)}
              {isExcluded && ' ✕'}
            </Badge>
          )
        })}
      </div>
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p>{labels?.toggleHint ?? 'Click to toggle. Red = excluded from catalog.'}</p>
        <p>{labels?.hint ?? 'Excluded classes can still pass via breakout rules (soft filter)'}</p>
      </div>
    </ConfigCard>
  )
}
