"use client"

import { Globe } from 'lucide-react'
import { ConfigCard } from '../ConfigCard'
import { TagInput } from './TagInput'
import { Label } from '@/shared/ui/label'

interface CountriesEditorProps {
  allowedCountries: string[]
  blockedCountries: string[]
  onAllowedChange: (value: string[]) => void
  onBlockedChange: (value: string[]) => void
  labels?: {
    title?: string
    allowed?: string
    blocked?: string
    allowedPlaceholder?: string
    blockedPlaceholder?: string
  }
}

/**
 * Editor for allowed/blocked countries configuration.
 */
export function CountriesEditor({
  allowedCountries,
  blockedCountries,
  onAllowedChange,
  onBlockedChange,
  labels,
}: CountriesEditorProps) {
  return (
    <ConfigCard title={labels?.title ?? 'Countries'} icon={Globe} contentClassName="space-y-4">
      <div>
        <Label className="text-green-600">{labels?.allowed ?? 'Allowed'} ({allowedCountries.length})</Label>
        <TagInput
          value={allowedCountries}
          onChange={onAllowedChange}
          placeholder={labels?.allowedPlaceholder ?? 'Add country code (e.g., US, UA)'}
          variant="default"
        />
      </div>
      <div>
        <Label className="text-red-600">{labels?.blocked ?? 'Blocked'} ({blockedCountries.length})</Label>
        <TagInput
          value={blockedCountries}
          onChange={onBlockedChange}
          placeholder={labels?.blockedPlaceholder ?? 'Add blocked country code'}
          variant="destructive"
        />
      </div>
    </ConfigCard>
  )
}
