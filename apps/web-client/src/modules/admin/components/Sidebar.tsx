"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import type { Route } from "next"
import { Menu, FileText, Play } from "lucide-react"
import { cn } from "../../../shared/utils/cn"
import { NavigationItem } from "../types"
import { Button } from "../../../shared/ui/button"
import { Badge } from "../../../shared/ui/badge"
import { useTranslation } from "../../../shared/i18n"
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../../shared/ui/sheet"

interface SidebarProps {
  navigationItems: NavigationItem[]
  userPermissions?: string[]
  className?: string
}

// Icon mapping for navigation items
const iconMap: Record<string, React.ReactNode> = {
  'policies': <FileText className="h-4 w-4" />,
  'runs': <Play className="h-4 w-4" />
}

// Translation key mapping for navigation items
const labelMap: Record<string, string> = {
  'policies': 'admin.navigation.policies',
  'runs': 'admin.navigation.runs'
}

/**
 * Sidebar - Responsive navigation component for admin interface
 * 
 * Features:
 * - Responsive: Sheet on mobile (< 768px), fixed panel on desktop
 * - Navigation items with Button variant="ghost"
 * - Active state based on current route
 * - Permissions-based visibility
 * - Badge support for notifications/counts
 * 
 * Requirements: 2.1, 2.2, 2.5, 11.3
 */
export function Sidebar({ 
  navigationItems, 
  userPermissions = [], 
  className 
}: SidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)
  const { dict } = useTranslation()

  // Filter navigation items based on permissions
  const visibleItems = React.useMemo(() => {
    return navigationItems.filter(item => {
      if (item.disabled) return false
      if (!item.permissions || item.permissions.length === 0) return true
      return item.permissions.some(permission => userPermissions.includes(permission))
    })
  }, [navigationItems, userPermissions])

  // Check if navigation item is active
  const isActive = React.useCallback((href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }, [pathname])

  // Get translated label for navigation item
  const getTranslatedLabel = React.useCallback((item: NavigationItem) => {
    const translationKey = labelMap[item.id]
    if (translationKey) {
      // Use nested object access for translation keys like 'admin.navigation.policies'
      const keys = translationKey.split('.')
      let value: any = dict
      for (const key of keys) {
        value = value?.[key]
      }
      return value || item.label
    }
    return item.label
  }, [dict])

  // Render navigation item
  const renderNavItem = React.useCallback((item: NavigationItem) => {
    const active = isActive(item.href)
    const icon = item.icon || iconMap[item.id]
    const label = getTranslatedLabel(item)
    
    return (
      <Link 
        key={item.id}
        href={item.href as Route}
        onClick={() => setIsMobileOpen(false)} // Close mobile menu on navigation
        className="block mb-1"
      >
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start py-3",
            active && "bg-secondary text-secondary-foreground"
          )}
        >
          {icon && (
            <span className="mr-2 h-4 w-4">
              {icon}
            </span>
          )}
          <span className="flex-1">{label}</span>
          {item.badge && (
            <Badge variant="default" className="ml-auto">
              {item.badge}
            </Badge>
          )}
        </Button>
      </Link>
    )
  }, [isActive, getTranslatedLabel])

  // Render navigation list
  const renderNavigation = () => (
    <nav className="space-y-2">
      {visibleItems.map(item => {
        if (item.children && item.children.length > 0) {
          // Render nested navigation (future enhancement)
          return (
            <div key={item.id} className="space-y-1">
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                {item.label}
              </div>
              <div className="space-y-1 pl-4">
                {item.children
                  .filter(child => {
                    if (child.disabled) return false
                    if (!child.permissions || child.permissions.length === 0) return true
                    return child.permissions.some(permission => userPermissions.includes(permission))
                  })
                  .map(renderNavItem)}
              </div>
            </div>
          )
        }
        
        return renderNavItem(item)
      })}
    </nav>
  )

  return (
    <>
      {/* Mobile Navigation - Sheet */}
      <div className="md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetHeader>
              <SheetTitle>{dict.admin.navigation.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {renderNavigation()}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Navigation - Fixed Panel */}
      <aside className={cn(
        "hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:z-50",
        className
      )}>
        <div className="flex flex-col flex-grow pt-5 bg-background border-r overflow-y-auto">
          <div className="flex-grow px-4 pb-4">
            {renderNavigation()}
          </div>
        </div>
      </aside>
    </>
  )
}

Sidebar.displayName = "Sidebar"

/**
 * SidebarTrigger - Mobile menu trigger button
 * Exported separately for use in headers
 */
export function SidebarTrigger({ 
  onClick,
  className 
}: { 
  onClick?: () => void
  className?: string 
}) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={cn("md:hidden", className)}
      onClick={onClick}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle navigation menu</span>
    </Button>
  )
}