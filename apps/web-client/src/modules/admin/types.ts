/**
 * Admin UI types
 * 
 * Domain types (Policy, EvaluationRun, etc.) are in core/api/admin.ts
 * This file contains only UI-specific types (component props, configs)
 */

import type { ReactNode, HTMLAttributes } from 'react'

// ============================================================================
// Navigation & Routing
// ============================================================================

export interface NavigationItem {
  id: string
  label: string
  href: string
  icon?: ReactNode
  badge?: string | number
  children?: NavigationItem[]
  permissions?: string[]
  disabled?: boolean
}

export interface BreadcrumbItem {
  label: string
  href?: string
}

// ============================================================================
// Component Props
// ============================================================================

export interface AdminShellProps {
  children: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  headerActions?: ReactNode
  navigationItems?: NavigationItem[]
  userPermissions?: string[]
  showSidebar?: boolean
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLDivElement> {
  status: string
  variant?: 'default' | 'compact'
}

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'input' | 'date'
  options?: { label: string; value: string }[]
  placeholder?: string
}

export interface FilterBarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  filters?: FilterConfig[]
  actions?: ReactNode
}

export interface ConfirmActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  requireTyping?: boolean
  onConfirm: () => Promise<void>
  variant?: 'default' | 'destructive'
}

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ErrorStateProps {
  error: string | Error
  retry?: () => void
  fallback?: ReactNode
  variant?: 'page' | 'section' | 'inline'
}

export interface LoadingStateProps {
  type: 'skeleton' | 'spinner' | 'progress'
  message?: string
}

// ============================================================================
// DataTable
// ============================================================================

export interface PaginationConfig {
  page: number
  limit: number
  total: number
  hasNext: boolean
}

export interface SortingConfig {
  column: string
  direction: 'asc' | 'desc'
}

export interface DropdownMenuItemProps {
  label: string
  onClick: () => void
  icon?: ReactNode
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

export interface DataTableColumnDef<T> {
  id: string
  header: string
  accessorKey?: keyof T
  cell?: (props: { row: { original: T }; getValue: () => unknown }) => ReactNode
  sortable?: boolean
  width?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumnDef<T>[]
  loading?: boolean
  error?: string
  pagination?: PaginationConfig
  sorting?: SortingConfig
  onSortingChange?: (sorting: SortingConfig) => void
  onPaginationChange?: (pagination: { page: number; limit: number }) => void
  rowActions?: (row: T) => DropdownMenuItemProps[]
  emptyState?: ReactNode
  className?: string
}

// ============================================================================
// Status types and constants
// ============================================================================

export type RunStatusType = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'promoted'
export type PolicyStatusType = 'active' | 'inactive'

export const RunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PROMOTED: 'promoted',
} as const satisfies Record<string, RunStatusType>

export const PolicyStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const satisfies Record<string, PolicyStatusType>

// ============================================================================
// Domain types (used in pages)
// ============================================================================

export interface BlockingReason {
  type: 'coverage' | 'errors' | 'status' | 'permissions'
  message: string
  details?: Record<string, unknown>
}

export interface ProgressStats {
  processed: number
  total: number
  eligible: number
  ineligible: number
  pending: number
  errors: number
}
