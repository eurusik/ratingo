"use client"

import { Tv } from 'lucide-react'
import { ConfigCard } from '../ConfigCard'
import { ComboboxTagInput, ComboboxOption } from './ComboboxTagInput'
import { useProviders } from '@/core/query'

interface ProvidersEditorProps {
  providers: string[]
  onChange: (value: string[]) => void
  labels?: {
    title?: string
    description?: string
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
  }
}

/** Editor for global streaming providers with autocomplete. */
export function ProvidersEditor({
  providers,
  onChange,
  labels,
}: ProvidersEditorProps) {
  const { data: providersData = [], isLoading } = useProviders()

  const options: ComboboxOption[] = providersData.map((p) => ({
    id: p.id,
    name: p.name,
    count: p.count,
  }))

  return (
    <ConfigCard 
      title={labels?.title ?? 'Global Providers'} 
      description={labels?.description ?? 'Content available on these platforms will be included'}
      icon={Tv}
    >
      <ComboboxTagInput
        value={providers}
        onChange={onChange}
        options={options}
        isLoading={isLoading}
        placeholder={labels?.placeholder ?? 'Select or add provider...'}
        searchPlaceholder={labels?.searchPlaceholder ?? 'Search providers...'}
        emptyText={labels?.emptyText ?? 'No providers found in catalog'}
        transform={(v) => v.toLowerCase()}
      />
    </ConfigCard>
  )
}
