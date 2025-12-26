"use client"

import { Settings } from 'lucide-react'
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
import type { BlockedCountryMode, EligibilityMode } from '@/core/api/admin'

interface SettingsEditorProps {
  eligibilityMode: EligibilityMode
  blockedCountryMode: BlockedCountryMode
  minRelevanceScore: number
  onEligibilityModeChange: (value: EligibilityMode) => void
  onBlockedCountryModeChange: (value: BlockedCountryMode) => void
  onMinRelevanceScoreChange: (value: number) => void
  labels?: {
    title?: string
    description?: string
    eligibilityMode?: string
    eligibilityModeHint?: string
    blockedCountryMode?: string
    blockedCountryModeHint?: string
    minRelevanceScore?: string
    minRelevanceScoreHint?: string
    strictLabel?: string
    strictDescription?: string
    relaxedLabel?: string
    relaxedDescription?: string
    anyLabel?: string
    anyDescription?: string
    majorityLabel?: string
    majorityDescription?: string
  }
}

/** Editor for policy settings (modes and thresholds). */
export function SettingsEditor({
  eligibilityMode,
  blockedCountryMode,
  minRelevanceScore,
  onEligibilityModeChange,
  onBlockedCountryModeChange,
  onMinRelevanceScoreChange,
  labels,
}: SettingsEditorProps) {
  return (
    <ConfigCard 
      title={labels?.title ?? 'Settings'} 
      description={labels?.description ?? 'Configure how content is evaluated'}
      icon={Settings} 
      contentClassName="space-y-4"
    >
      <div className="space-y-2">
        <Label>{labels?.eligibilityMode ?? 'Eligibility Mode'}</Label>
        <Select value={eligibilityMode} onValueChange={onEligibilityModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STRICT">
              <div className="flex flex-col items-start">
                <span>{labels?.strictLabel ?? 'Strict'}</span>
                <span className="text-xs text-muted-foreground">
                  {labels?.strictDescription ?? 'All conditions must be met'}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="RELAXED">
              <div className="flex flex-col items-start">
                <span>{labels?.relaxedLabel ?? 'Relaxed'}</span>
                <span className="text-xs text-muted-foreground">
                  {labels?.relaxedDescription ?? 'Some conditions can be skipped'}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {labels?.eligibilityModeHint && (
          <p className="text-xs text-muted-foreground">{labels.eligibilityModeHint}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{labels?.blockedCountryMode ?? 'Blocked Country Mode'}</Label>
        <Select value={blockedCountryMode} onValueChange={onBlockedCountryModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">
              <div className="flex flex-col items-start">
                <span>{labels?.anyLabel ?? 'Any'}</span>
                <span className="text-xs text-muted-foreground">
                  {labels?.anyDescription ?? 'Block if available in any blocked country'}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="MAJORITY">
              <div className="flex flex-col items-start">
                <span>{labels?.majorityLabel ?? 'Majority'}</span>
                <span className="text-xs text-muted-foreground">
                  {labels?.majorityDescription ?? 'Block only if majority of countries are blocked'}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {labels?.blockedCountryModeHint && (
          <p className="text-xs text-muted-foreground">{labels.blockedCountryModeHint}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{labels?.minRelevanceScore ?? 'Min Relevance Score'}</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={minRelevanceScore}
          onChange={(e) => onMinRelevanceScoreChange(Number(e.target.value))}
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">
          {labels?.minRelevanceScoreHint ?? 'Minimum score (0-100) for homepage visibility'}
        </p>
      </div>
    </ConfigCard>
  )
}
