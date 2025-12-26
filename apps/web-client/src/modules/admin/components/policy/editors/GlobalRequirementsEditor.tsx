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
import type { GlobalRequirements } from '@/core/api/admin'

type RatingSource = 'imdb' | 'metacritic' | 'rt' | 'trakt'
type VoteSource = 'imdb' | 'trakt'

interface GlobalRequirementsEditorProps {
  globalRequirements?: GlobalRequirements
  onChange: (value: GlobalRequirements | undefined) => void
  labels?: {
    title?: string
    description?: string
    minQualityScore?: string
    minQualityScoreHint?: string
    requireRatings?: string
    requireRatingsHint?: string
    addRating?: string
    minVotesAnyOf?: string
    minVotesAnyOfHint?: string
    minVotesThreshold?: string
    voteSources?: string
  }
}

const RATING_SOURCE_LABELS: Record<RatingSource, string> = {
  imdb: 'IMDb',
  metacritic: 'Metacritic',
  rt: 'Rotten Tomatoes',
  trakt: 'Trakt',
}

const VOTE_SOURCE_LABELS: Record<VoteSource, string> = {
  imdb: 'IMDb',
  trakt: 'Trakt',
}

const RATING_SOURCES: RatingSource[] = ['imdb', 'metacritic', 'rt', 'trakt']
const VOTE_SOURCES: VoteSource[] = ['imdb', 'trakt']

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
      updateField('requireAnyOfRatingsPresent', [...current, source])
    }
  }

  const removeRatingSource = (source: RatingSource) => {
    const current = globalRequirements?.requireAnyOfRatingsPresent || []
    const updated = current.filter((s) => s !== source)
    updateField('requireAnyOfRatingsPresent', updated.length > 0 ? updated : undefined)
  }

  const toggleVoteSource = (source: VoteSource, checked: boolean) => {
    const current = globalRequirements?.minVotesAnyOf
    const currentSources = current?.sources || []
    
    let newSources: VoteSource[]
    if (checked) {
      newSources = [...currentSources, source]
    } else {
      newSources = currentSources.filter((s) => s !== source)
    }
    
    if (newSources.length === 0) {
      updateField('minVotesAnyOf', undefined)
    } else {
      updateField('minVotesAnyOf', {
        sources: newSources,
        min: current?.min ?? 0,
      })
    }
  }

  const updateMinVotes = (min: number | undefined) => {
    const current = globalRequirements?.minVotesAnyOf
    if (min === undefined || min === 0) {
      if (!current?.sources?.length) {
        updateField('minVotesAnyOf', undefined)
      } else {
        updateField('minVotesAnyOf', { ...current, min: min ?? 0 })
      }
    } else {
      updateField('minVotesAnyOf', {
        sources: current?.sources || ['imdb', 'trakt'],
        min,
      })
    }
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
        <Label>{labels?.minQualityScore ?? 'Min Quality Score'}</Label>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={globalRequirements?.minQualityScoreNormalized ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? undefined : Number(e.target.value)
            updateField('minQualityScoreNormalized', value)
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
            'Content must have at least one of these rating sources (OR logic)'}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{labels?.minVotesAnyOf ?? 'Min Votes (Any Source)'}</Label>
        <div className="flex gap-4 items-center mb-2">
          {VOTE_SOURCES.map((source) => (
            <label key={source} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={globalRequirements?.minVotesAnyOf?.sources?.includes(source) ?? false}
                onChange={(e) => toggleVoteSource(source, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {VOTE_SOURCE_LABELS[source]}
            </label>
          ))}
        </div>
        <Input
          type="number"
          min={0}
          step={100}
          value={globalRequirements?.minVotesAnyOf?.min ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? undefined : Number(e.target.value)
            updateMinVotes(value)
          }}
          placeholder="e.g., 3000"
          className="h-9"
          disabled={!globalRequirements?.minVotesAnyOf?.sources?.length}
        />
        <p className="text-xs text-muted-foreground">
          {labels?.minVotesAnyOfHint ??
            'Passes if ANY selected source has enough votes. Robust to missing data.'}
        </p>
      </div>
    </ConfigCard>
  )
}
