"use client"

import * as React from 'react'
import { Search } from 'lucide-react'
import { useDebounce } from 'use-debounce'

import { cn } from '../../../shared/utils'
import { Input } from '../../../shared/ui/input'
import { Button } from '../../../shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import { useTranslation } from '../../../shared/i18n'

import { FilterBarProps, FilterConfig } from '../types'

function FilterBar({
  searchValue = '',
  onSearchChange,
  filters = [],
  actions,
  className,
}: FilterBarProps & { className?: string }) {
  const [internalSearchValue, setInternalSearchValue] = React.useState(searchValue)
  const [debouncedSearchValue] = useDebounce(internalSearchValue, 300)
  const { dict } = useTranslation()

  // Update parent when debounced value changes
  React.useEffect(() => {
    if (onSearchChange && debouncedSearchValue !== searchValue) {
      onSearchChange(debouncedSearchValue)
    }
  }, [debouncedSearchValue, onSearchChange, searchValue])

  // Update internal value when prop changes
  React.useEffect(() => {
    setInternalSearchValue(searchValue)
  }, [searchValue])

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInternalSearchValue(event.target.value)
  }

  const renderFilter = (filter: FilterConfig) => {
    switch (filter.type) {
      case 'select':
        return (
          <Select key={filter.key}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={filter.placeholder || `${dict.admin.common.select || 'Select'} ${filter.label}`} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'input':
        return (
          <Input
            key={filter.key}
            placeholder={filter.placeholder || filter.label}
            className="w-[180px]"
          />
        )

      case 'date':
        return (
          <Input
            key={filter.key}
            type="date"
            placeholder={filter.placeholder || filter.label}
            className="w-[180px]"
          />
        )

      default:
        return null
    }
  }

  return (
    <div className={cn("flex items-center justify-between space-x-4", className)}>
      <div className="flex items-center space-x-4">
        {/* Search Input */}
        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={dict.admin.common.search}
              value={internalSearchValue}
              onChange={handleSearchChange}
              className="pl-8 w-[300px]"
            />
          </div>
        )}

        {/* Filters */}
        {filters.map(renderFilter)}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center space-x-2">
          {actions}
        </div>
      )}
    </div>
  )
}

export { FilterBar }