"use client"

import { useState, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/shared/ui/input'
import { Badge } from '@/shared/ui/badge'

interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  variant?: 'default' | 'destructive'
  disabled?: boolean
  transform?: (value: string) => string
}

/**
 * Input for managing list of tags (countries, languages, providers).
 * 
 * Supports adding via Enter/comma and removing via X button or backspace.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Type and press Enter',
  variant = 'default',
  disabled = false,
  transform = (v) => v.toUpperCase(),
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addTag = (tag: string) => {
    const transformed = transform(tag.trim())
    if (transformed && !value.includes(transformed)) {
      onChange([...value, transformed])
    }
    setInputValue('')
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  const badgeVariant = variant === 'destructive' ? 'destructive' : 'outline'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {value.map((tag) => (
          <Badge key={tag} variant={badgeVariant} className="text-xs gap-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 text-sm"
      />
    </div>
  )
}
