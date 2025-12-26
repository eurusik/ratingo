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

interface SettingsEditorProps {
  eligibilityMode: 'STRICT' | 'RELAXED'
  blockedCountryMode: 'ANY' | 'MAJORITY'
  minRelevanceScore: number
  onEligibilityModeChange: (value: 'STRICT' | 'RELAXED') => void
  onBlockedCountryModeChange: (value: 'ANY' | 'MAJORITY') => void
  onMinRelevanceScoreChange: (value: number) => void
  labels?: {
    title?: string
    eligibilityMode?: string
    blockedCountryMode?: string
    minRelevanceScore?: string
  }
}

/**
 * Editor for policy settings (modes and thresholds).
 */
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
    <ConfigCard title={labels?.title ?? 'Settings'} icon={Settings} contentClassName="space-y-4">
      <div className="space-y-2">
        <Label>{labels?.eligibilityMode ?? 'Eligibility Mode'}</Label>
        <Select value={eligibilityMode} onValueChange={onEligibilityModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STRICT">STRICT</SelectItem>
            <SelectItem value="RELAXED">RELAXED</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{labels?.blockedCountryMode ?? 'Blocked Country Mode'}</Label>
        <Select value={blockedCountryMode} onValueChange={onBlockedCountryModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">ANY</SelectItem>
            <SelectItem value="MAJORITY">MAJORITY</SelectItem>
          </SelectContent>
        </Select>
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
      </div>
    </ConfigCard>
  )
}
