/**
 * Admin UI types.
 *
 * UI-specific types (component props, configs).
 * Domain types are in core/api/admin.ts.
 */

import type { ReactNode } from 'react';

// ============================================================================
// Navigation & Routing
// ============================================================================

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
  children?: NavigationItem[];
  permissions?: string[];
  disabled?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ============================================================================
// Component Props
// ============================================================================

export interface AdminShellProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  headerActions?: ReactNode;
  navigationItems?: NavigationItem[];
  userPermissions?: string[];
  showSidebar?: boolean;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'input' | 'date';
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterConfig[];
  actions?: ReactNode;
}

// ============================================================================
// DataTable
// ============================================================================

interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

interface SortingConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface DropdownMenuItemProps {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface DataTableColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (props: { row: { original: T }; getValue: () => unknown }) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumnDef<T>[];
  loading?: boolean;
  error?: string;
  pagination?: PaginationConfig;
  sorting?: SortingConfig;
  onSortingChange?: (sorting: SortingConfig) => void;
  onPaginationChange?: (pagination: { page: number; limit: number }) => void;
  rowActions?: (row: T) => DropdownMenuItemProps[];
  emptyState?: ReactNode;
  className?: string;
}

// ============================================================================
// Status types and constants
// ============================================================================

// Run status type (uses 'prepared' not 'success')
export type RunStatusType = 'running' | 'prepared' | 'failed' | 'cancelled' | 'promoted';
export type PolicyStatusType = 'active' | 'inactive';

/**
 * Run status constants.
 *
 * @example
 * if (run.status === RUN_STATUS.PREPARED) { ... }
 */
export const RUN_STATUS = {
  RUNNING: 'running',
  PREPARED: 'prepared',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PROMOTED: 'promoted',
} as const satisfies Record<string, RunStatusType>;

/**
 * Policy status constants.
 *
 * @example
 * if (policy.status === POLICY_STATUS.ACTIVE) { ... }
 */
export const POLICY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const satisfies Record<string, PolicyStatusType>;

// ============================================================================
// Domain types (used in pages) - DEPRECATED
// ============================================================================

/**
 * @deprecated Use components['schemas']['ProgressStatsDto'] from @ratingo/api-contract
 */
export interface ProgressStats {
  processed: number;
  total: number;
  eligible: number;
  ineligible: number;
  errors: number;
}
