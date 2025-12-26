"use client"

import { Languages } from 'lucide-react'
import { ConfigCard } from '../ConfigCard'
import { TagInput } from './TagInput'
import { Label } from '@/shared/ui/label'

interface LanguagesEditorProps {
  allowedLanguages: string[]
  blockedLanguages: string[]
  onAllowedChange: (value: string[]) => void
  onBlockedChange: (value: string[]) => void
  labels?: {
    title?: string
    description?: string
    allowed?: string
    blocked?: string
    allowedPlaceholder?: string
    blockedPlaceholder?: string
  }
}

/**
 * Editor for allowed/blocked languages configuration.
 */
export function LanguagesEditor({
  allowedLanguages,
  blockedLanguages,
  onAllowedChange,
  onBlockedChange,
  labels,
}: LanguagesEditorProps) {
  return (
    <ConfigCard 
      title={labels?.title ?? 'Languages'} 
      description={labels?.description ?? 'Filter content by original language'}
      icon={Languages} 
      contentClassName="space-y-4"
    >
      <div>
        <Label className="text-green-600">{labels?.allowed ?? 'Allowed'} ({allowedLanguages.length})</Label>
        <TagInput
          value={allowedLanguages}
          onChange={onAllowedChange}
          placeholder={labels?.allowedPlaceholder ?? 'Add language code (e.g., en, uk)'}
          variant="default"
          transform={(v) => v.toLowerCase()}
        />
      </div>
      <div>
        <Label className="text-red-600">{labels?.blocked ?? 'Blocked'} ({blockedLanguages.length})</Label>
        <TagInput
          value={blockedLanguages}
          onChange={onBlockedChange}
          placeholder={labels?.blockedPlaceholder ?? 'Add blocked language code'}
          variant="destructive"
          transform={(v) => v.toLowerCase()}
        />
      </div>
    </ConfigCard>
  )
}
