"use client"

import { Tv } from 'lucide-react'
import { ConfigCard } from '../ConfigCard'
import { TagInput } from './TagInput'

interface ProvidersEditorProps {
  providers: string[]
  onChange: (value: string[]) => void
  labels?: {
    title?: string
    placeholder?: string
  }
}

/**
 * Editor for global streaming providers.
 */
export function ProvidersEditor({
  providers,
  onChange,
  labels,
}: ProvidersEditorProps) {
  return (
    <ConfigCard title={labels?.title ?? 'Global Providers'} icon={Tv}>
      <TagInput
        value={providers}
        onChange={onChange}
        placeholder={labels?.placeholder ?? 'Add provider (e.g., netflix, max)'}
        variant="default"
        transform={(v) => v.toLowerCase()}
      />
    </ConfigCard>
  )
}
