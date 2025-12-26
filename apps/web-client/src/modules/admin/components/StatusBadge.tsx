import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/utils'
import type { RunStatusType, PolicyStatusType } from '../types'
import { useTranslation } from '@/shared/i18n'

// Badge variants with success variant for status mapping
const statusBadgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100',
        success: 'border-transparent bg-green-500 text-white shadow hover:bg-green-600',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        compact: 'px-2 py-0.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

// Status to variant mapping
const statusVariantMap: Record<string, VariantProps<typeof statusBadgeVariants>['variant']> = {
  // RunStatus mapping
  'running': 'default',      // blue styling
  'prepared': 'success',     // green styling (changed from 'success' status)
  'success': 'success',      // green styling (legacy support)
  'failed': 'destructive',   // red styling
  'cancelled': 'secondary',  // gray styling
  'promoted': 'outline',     // purple/special styling
  'pending': 'outline',      // pending status
  
  // PolicyStatus mapping
  'active': 'success',       // green styling
  'inactive': 'secondary',   // gray styling
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof statusBadgeVariants>, 'variant'> {
  status: string | RunStatusType | PolicyStatusType
  variant?: 'default' | 'compact'
}

/**
 * Status badge with translated text.
 * 
 * @example
 * <StatusBadge status="running" />
 */
function StatusBadge({ className, status, variant = 'default', ...props }: StatusBadgeProps) {
  const { dict } = useTranslation()
  const badgeVariant = statusVariantMap[status] || 'default'
  const size = variant === 'compact' ? 'compact' : 'default'
  
  // Gets translated status text
  const getStatusText = (status: string): string => {
    // Check if it's a run status
    if (status in (dict.admin.policies.runStatus || {})) {
      return dict.admin.policies.runStatus[status as keyof typeof dict.admin.policies.runStatus]
    }
    // Check if it's a policy status
    if (status in (dict.admin.policies.status || {})) {
      return dict.admin.policies.status[status as keyof typeof dict.admin.policies.status]
    }
    // Fallback to raw status
    return status
  }
  
  return (
    <div 
      className={cn(statusBadgeVariants({ variant: badgeVariant, size }), className)} 
      data-testid="status-badge"
      data-status={status}
      {...props}
    >
      {getStatusText(status)}
    </div>
  )
}

export { StatusBadge, statusBadgeVariants, statusVariantMap }