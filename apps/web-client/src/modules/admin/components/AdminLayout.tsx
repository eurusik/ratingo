"use client"

import * as React from "react"
import { AdminShell, getAdminNavigation } from "../"
import { BreadcrumbItem } from "../types"

interface AdminLayoutProps {
  children: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  headerActions?: React.ReactNode
  userPermissions?: string[]
}

/**
 * Standard admin layout wrapper
 * Use this in admin pages instead of AdminShell directly
 */
export function AdminLayout({ 
  children, 
  breadcrumbs = [], 
  headerActions,
  userPermissions = []
}: AdminLayoutProps) {
  const navigation = getAdminNavigation(userPermissions)
  
  return (
    <AdminShell
      navigationItems={navigation}
      showSidebar={true}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      userPermissions={userPermissions}
    >
      {children}
    </AdminShell>
  )
}