"use client"

import { Shield } from 'lucide-react'
import { ConfigCard } from '../ConfigCard'
import { Label } from '@/shared/ui/label'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Badge } from '@/shared/ui/badge'
import { X } from 'lucide-react'
import type { components } from '@ratingo/api-contract'

type GlobalRequirements = components['schemas']['GlobalRequirementsDto']
type RatingSource = NonNullable<GlobalRequirements['requireAnyOfRatingsPresent']>[number]

interface GlobalRequirementsEditorProps {
  globalRequirements?: GlobalRequirements
  onChange: (value: GlobalRequirements | undefined) => void
  labels?: {
    title?: string
    description?: string
    minImdbVotes?: string
    minImdbVotesHint?: string
    minTraktVotes?: string
    minTraktVotesHint?: string
    minQualityScore?: string
    minQualityScoreHint?: string
    requireRatings?: string
    requireRatingsHint?: string
    addRating?: string
  }
}

const RATING_SOURCE_LABELS: Record<RatingSource, string> = {
  imdb: 'IMDb',
  metacritic: 'Metacritic',
  rt: 'Rotten Tomatoes',
  trakt: 'Trakt',
}

const RATING_SOURCES: RatingSource[] = ['imdb', 'metacritic', 'rt', 'trakt']

// Type-safe field keys derived from the schema
const FIELD_KEYS = {
  minImdbVotes: 'minImdbVotes',
  minTraktVotes: 'minTraktVotes',
  minQualityScoreNormalized: 'minQualityScoreNormalized',
  requireAnyOfRatingsPresent: 'requireAnyOfRatingsPresent',
} as const satisfies Record<keyof GlobalRequirements, keyof GlobalRequirements>

/** Editor for global quality gate requirements. */
export function GlobalRequirementsEditor({
  globalRequirements,
  onChange,
  labels,
}: GlobalRequirementsEditorProps) {
  const updateField = <K extends keyof GlobalRequirements>(
    field: K,
    value: GlobalRequirements[K]
  ) => {
    const updated = { ...globalRequirements, [field]: value }
    
    // Clean up undefined values
    Object.keys(updated).forEach((key) => {
      if (updated[key as keyof GlobalRequirements] === undefined) {
        delete updated[key as keyof GlobalRequirements]
      }
    })
    
    // If all fields are empty, set to undefined
    if (Object.keys(updated).length === 0) {
      onChange(undefined)
    } else {
      onChange(updated)
    }
  }

  const addRatingSource = (source: RatingSource) => {
    const current = globalRequirements?.requireAnyOfRatingsPresent || []
    if (!current.includes(source)) {
      updateField(FIELD_KEYS.requireAnyOfRatingsPresent, [...current, source])
    }
  }

  const removeRatingSource = (source: RatingSource) => {
    const current = globalRequirements?.requireAnyOfRatingsPresent || []
    const updated = current.filter((s) => s !== source)
    updateField(FIELD_KEYS.requireAnyOfRatingsPresent, updated.length > 0 ? updated : undefined)
  }

  const availableRatingSources = RATING_SOURCES.filter(
    (source) => !(globalRequirements?.requireAnyOfRatingsPresent || []).includes(source)
  )

  return (
    <ConfigCard
      title={labels?.title ?? 'Global Quality Gate'}
      description={
        labels?.description ??
        'Minimum quality thresholds that all content must meet'
      }
      icon={Shield}
      contentClassName="space-y-4"
    >
      <div className="space-y-2">
        <Label>{labels?.minImdbVotes ?? 'Min IMDb Votes'}</Label>
        <Input
          type="number"
          min={0}
          step={1}
          value={globalRequirements?.minImdbVotes ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? undefined : Number(e.target.value)
            updateField(FIELD_KEYS.minImdbVotes, value)
          }}
          placeholder="e.g., 3000"
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">
          {labels?.minImdbVotesHint ?? 'Minimum number of IMDb votes required'}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{labels?.minTraktVotes ?? 'Min Trakt Votes'}</Label>
        <Input
          type="number"
          min={0}
          step={1}
          value={globalRequirements?.minTraktVotes ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? undefined : Number(e.target.value)
            updateField(FIELD_KEYS.minTraktVotes, value)
          }}
          placeholder="e.g., 1000"
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">
          {labels?.minTraktVotesHint ?? 'Minimum number of Trakt votes required'}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{labels?.minQualityScore ?? 'Min Quality Score'}</Label>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={globalRequirements?.minQualityScoreNormalized ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? undefined : Number(e.target.value)
            updateField(FIELD_KEYS.minQualityScoreNormalized, value)
          }}
          placeholder="e.g., 0.6"
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">
          {labels?.minQualityScoreHint ?? 'Minimum quality score (0-1 range)'}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{labels?.requireRatings ?? 'Required Rating Sources'}</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(globalRequirements?.requireAnyOfRatingsPresent || []).map((source) => (
            <Badge key={source} variant="secondary" className="gap-1">
              {RATING_SOURCE_LABELS[source]}
              <button
                type="button"
                onClick={() => removeRatingSource(source)}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        {availableRatingSources.length > 0 && (
          <Select onValueChange={(value) => addRatingSource(value as RatingSource)}>
            <SelectTrigger>
              <SelectValue placeholder={labels?.addRating ?? 'Add rating source...'} />
            </SelectTrigger>
            <SelectContent>
              {availableRatingSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {RATING_SOURCE_LABELS[source]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">
          {labels?.requireRatingsHint ??
            'Content must have at least one of these rating sources'}
        </p>
      </div>
    </ConfigCard>
  )
}
