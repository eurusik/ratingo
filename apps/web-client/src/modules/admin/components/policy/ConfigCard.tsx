"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { LucideIcon } from 'lucide-react'

interface ConfigCardProps {
  title: string
  icon: LucideIcon
  children: React.ReactNode
  contentClassName?: string
}

/**
 * Base card wrapper for config sections
 */
export function ConfigCard({ title, icon: Icon, children, contentClassName }: ConfigCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>
        {children}
      </CardContent>
    </Card>
  )
}
