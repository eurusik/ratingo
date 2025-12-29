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
type EvaluationContext = 'catalog' | 'homepage' | 'trending' | 'now_playing' | 'new_digital' | 'search'

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
    appliesTo?: string
    appliesToHint?: string
    qualityDrivenLabel?: string
    qualityBadge?: string
    qualityHint?: string
    freshnessDrivenLabel?: string
    freshnessBadge?: string
    freshnessHint?: string
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
// Quality-driven contexts (gate applies by default)
const QUALITY_CONTEXTS: EvaluationContext[] = ['catalog', 'homepage', 'trending']
// Freshness-driven contexts (gate excluded by default)
const FRESHNESS_CONTEXTS: EvaluationContext[] = ['now_playing', 'new_digital']
const DEFAULT_QUALITY_CONTEXTS: EvaluationContext[] = ['catalog', 'homepage', 'trending', 'search']

const CONTEXT_LABELS: Record<EvaluationContext, string> = {
  catalog: 'Catalog',
  homepage: 'Homepage',
  trending: 'Trending',
  now_playing: 'Now Playing',
  new_digital: 'New on Digital',
  search: 'Search',
}

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

  const toggleContext = (context: EvaluationContext, checked: boolean) => {
    // Get current appliesTo or use defaults
    const current = globalRequirements?.appliesTo ?? DEFAULT_QUALITY_CONTEXTS
    
    let newContexts: EvaluationContext[]
    if (checked) {
      newContexts = [...current, context]
    } else {
      newContexts = current.filter((c) => c !== context)
    }
    
    // If matches default, remove the field (use implicit default)
    const isDefault = 
      newContexts.length === DEFAULT_QUALITY_CONTEXTS.length &&
      DEFAULT_QUALITY_CONTEXTS.every((c) => newContexts.includes(c))
    
    updateField('appliesTo', isDefault ? undefined : newContexts)
  }

  const getActiveContexts = (): EvaluationContext[] => {
    return globalRequirements?.appliesTo ?? DEFAULT_QUALITY_CONTEXTS
  }

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

      <div className="space-y-4">
        <Label>{labels?.appliesTo ?? 'Quality gate applies to'}</Label>
        
        {/* Quality surfaces - gate is mandatory */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {labels?.qualityDrivenLabel ?? 'Quality surfaces'}
            </p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {labels?.qualityBadge ?? 'gate required'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUALITY_CONTEXTS.map((context) => (
              <label key={context} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={getActiveContexts().includes(context)}
                  onChange={(e) => toggleContext(context, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {CONTEXT_LABELS[context]}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {labels?.qualityHint ?? 'Only shows content meeting minimum quality standards.'}
          </p>
        </div>
        
        {/* Freshness surfaces - gate disabled by default */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {labels?.freshnessDrivenLabel ?? 'Freshness surfaces'}
            </p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {labels?.freshnessBadge ?? 'gate off by default'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FRESHNESS_CONTEXTS.map((context) => (
              <label key={context} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={getActiveContexts().includes(context)}
                  onChange={(e) => toggleContext(context, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {CONTEXT_LABELS[context]}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {labels?.freshnessHint ?? 'Prioritizes recency. New releases may lack ratings/votes.'}
          </p>
        </div>
      </div>
    </ConfigCard>
  )
}
