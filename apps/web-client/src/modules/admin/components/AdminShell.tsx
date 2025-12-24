"use client"

import * as React from "react"
import { cn } from "../../../shared/utils/cn"
import { AdminShellProps, NavigationItem } from "../types"
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../shared/ui/breadcrumb"
import { Separator } from "../../../shared/ui/separator"
import { Sidebar, SidebarTrigger } from "./Sidebar"

interface AdminShellWithSidebarProps extends AdminShellProps {
  navigationItems?: NavigationItem[]
  userPermissions?: string[]
  showSidebar?: boolean
}

/**
 * AdminShell - Main layout component for all admin pages
 * 
 * Provides consistent layout structure with:
 * - Responsive container (max-w-6xl mx-auto space-y-6)
 * - Optional responsive sidebar (Sheet on mobile, fixed on desktop)
 * - Header with breadcrumbs and actions
 * - Content area for module rendering
 * 
 * Requirements: 2.1, 2.3, 2.4, 2.6, 9.1
 */
export function AdminShell({ 
  children, 
  breadcrumbs = [], 
  headerActions,
  navigationItems = [],
  userPermissions = [],
  showSidebar = false,
  className,
  ...props 
}: AdminShellWithSidebarProps & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - only render if navigationItems provided and showSidebar is true */}
      {showSidebar && navigationItems.length > 0 && (
        <Sidebar 
          navigationItems={navigationItems}
          userPermissions={userPermissions}
        />
      )}

      {/* Main content area */}
      <div 
        className={cn(
          "max-w-6xl mx-auto space-y-6 p-6",
          showSidebar && navigationItems.length > 0 && "md:ml-64", // Offset for fixed sidebar on desktop
          className
        )}
        {...props}
      >
        {/* Header with breadcrumbs and actions */}
        {(breadcrumbs.length > 0 || headerActions || (showSidebar && navigationItems.length > 0)) && (
          <header className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Mobile sidebar trigger - only show if sidebar is enabled */}
              {showSidebar && navigationItems.length > 0 && (
                <>
                  <SidebarTrigger />
                  {(breadcrumbs.length > 0 || headerActions) && (
                    <Separator orientation="vertical" className="h-6" />
                  )}
                </>
              )}
              
              {breadcrumbs.length > 0 && (
                <>
                  <Breadcrumb>
                    <BreadcrumbList>
                      {breadcrumbs.map((item, index) => (
                        <React.Fragment key={item.label}>
                          <BreadcrumbItem>
                            {item.href && index < breadcrumbs.length - 1 ? (
                              <BreadcrumbLink href={item.href}>
                                {item.label}
                              </BreadcrumbLink>
                            ) : (
                              <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            )}
                          </BreadcrumbItem>
                          {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                        </React.Fragment>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>
                  {headerActions && <Separator orientation="vertical" className="h-6" />}
                </>
              )}
            </div>
            
            {/* Header actions */}
            {headerActions && (
              <div className="flex items-center space-x-2">
                {headerActions}
              </div>
            )}
          </header>
        )}

        {/* Content area for module rendering */}
        <main className="space-y-6">
          {children}
        </main>
      </div>
    </div>
  )
}

AdminShell.displayName = "AdminShell"