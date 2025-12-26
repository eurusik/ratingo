"use client"

import { useState, useRef, KeyboardEvent } from 'react'
import { X, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Input } from '@/shared/ui/input'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/popover'
import { cn } from '@/shared/utils/cn'

/** Combobox option with optional count. */
export interface ComboboxOption {
  id: string
  name: string
  count?: number
}

interface ComboboxTagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  options: ComboboxOption[]
  isLoading?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  variant?: 'default' | 'destructive'
  disabled?: boolean
  transform?: (value: string) => string
}

/**
 * Combobox with tag input for selecting from suggestions or adding custom values.
 */
export function ComboboxTagInput({
  value,
  onChange,
  options,
  isLoading = false,
  placeholder = 'Select or type...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found',
  variant = 'default',
  disabled = false,
  transform = (v) => v.toLowerCase(),
}: ComboboxTagInputProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase()) ||
    opt.id.toLowerCase().includes(search.toLowerCase())
  )

  const searchMatchesOption = options.some(
    (opt) => opt.name.toLowerCase() === search.toLowerCase() ||
             opt.id.toLowerCase() === search.toLowerCase()
  )

  const addTag = (tag: string) => {
    const transformed = transform(tag.trim())
    if (transformed && !value.includes(transformed)) {
      onChange([...value, transformed])
    }
    setSearch('')
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  const toggleOption = (option: ComboboxOption) => {
    const transformed = transform(option.name)
    if (value.includes(transformed)) {
      removeTag(transformed)
    } else {
      addTag(option.name)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (search.trim()) {
        addTag(search)
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && !search && value.length > 0) {
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-8 text-sm font-normal text-muted-foreground"
          >
            {placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          
          <div className="max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : filteredOptions.length === 0 && !search ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              <>
                {filteredOptions.map((option) => {
                  const isSelected = value.includes(transform(option.name))
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(option)}
                      className={cn(
                        "flex items-center w-full px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                        isSelected && "bg-accent"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1 text-left">{option.name}</span>
                      {option.count !== undefined && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({option.count})
                        </span>
                      )}
                    </button>
                  )
                })}

                {search && !searchMatchesOption && (
                  <button
                    type="button"
                    onClick={() => {
                      addTag(search)
                      setOpen(false)
                    }}
                    className="flex items-center w-full px-2 py-1.5 text-sm hover:bg-accent cursor-pointer border-t"
                  >
                    <span className="mr-2 text-muted-foreground">+</span>
                    <span>Add &quot;{search}&quot;</span>
                  </button>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
