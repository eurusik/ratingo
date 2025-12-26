"use client"

import { Badge } from '@/shared/ui/badge'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive'

interface SettingRowProps {
  label: string
  value: string | number
  variant?: BadgeVariant
}

/**
 * Single setting row with label and badge value
 */
export function SettingRow({ label, value, variant = 'secondary' }: SettingRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={variant}>{value}</Badge>
    </div>
  )
}
