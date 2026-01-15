'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { Menu, FileText, Play, Tv, Newspaper, LayoutDashboard, Plug } from 'lucide-react';
import { cn } from '@/shared/utils';
import { NavigationItem } from '../../types';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { useTranslation } from '@/shared/i18n';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/ui/sheet';

interface SidebarProps {
  navigationItems: NavigationItem[];
  userPermissions?: string[];
  className?: string;
}

// Icon mapping for navigation items and groups
const iconMap: Record<string, React.ReactNode> = {
  // Groups
  catalog: <LayoutDashboard className="h-4 w-4" />,
  integrations: <Plug className="h-4 w-4" />,
  // Items
  policies: <FileText className="h-4 w-4" />,
  runs: <Play className="h-4 w-4" />,
  providers: <Tv className="h-4 w-4" />,
  journal: <Newspaper className="h-4 w-4" />,
};

// Translation key mapping for navigation items
const labelMap: Record<string, string> = {
  // Groups
  catalog: 'admin.navigation.catalog',
  integrations: 'admin.navigation.integrations',
  // Items
  policies: 'admin.navigation.policies',
  runs: 'admin.navigation.runs',
  providers: 'admin.navigation.providers',
  journal: 'admin.navigation.journal',
};

// Standalone items that should have a separator before them
const standaloneItems = new Set(['journal']);

/**
 * Sidebar - Responsive navigation component for admin interface
 *
 * Features:
 * - Responsive: Sheet on mobile (< 768px), fixed panel on desktop
 * - Grouped navigation with section headers
 * - Navigation items with Button variant="ghost"
 * - Active state based on current route
 * - Permissions-based visibility
 * - Badge support for notifications/counts
 *
 * Requirements: 2.1, 2.2, 2.5, 11.3
 */
export function Sidebar({ navigationItems, userPermissions = [], className }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const { dict } = useTranslation();

  // Filter navigation items based on permissions
  const visibleItems = React.useMemo(() => {
    return navigationItems.filter((item) => {
      if (item.disabled) return false;
      if (!item.permissions || item.permissions.length === 0) return true;
      return item.permissions.some((permission) => userPermissions.includes(permission));
    });
  }, [navigationItems, userPermissions]);

  // Check if navigation item is active
  const isActive = React.useCallback(
    (href: string) => {
      return pathname === href || pathname.startsWith(href + '/');
    },
    [pathname],
  );

  // Get translated label for navigation item
  const getTranslatedLabel = React.useCallback(
    (item: NavigationItem) => {
      const translationKey = labelMap[item.id];
      if (translationKey) {
        const keys = translationKey.split('.');
        let value: unknown = dict;
        for (const key of keys) {
          value = (value as Record<string, unknown>)?.[key];
        }
        return (value as string) || item.label;
      }
      return item.label;
    },
    [dict],
  );

  // Render a single navigation item (leaf node)
  const renderNavItem = React.useCallback(
    (item: NavigationItem) => {
      const active = isActive(item.href);
      const icon = item.icon || iconMap[item.id];
      const label = getTranslatedLabel(item);

      return (
        <Link
          key={item.id}
          href={item.href as Route}
          onClick={() => setIsMobileOpen(false)}
          className="block"
        >
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start py-2.5 h-auto',
              active && 'bg-secondary text-secondary-foreground',
            )}
          >
            {icon && <span className="mr-2.5 h-4 w-4 opacity-70">{icon}</span>}
            <span className="flex-1 text-left">{label}</span>
            {item.badge && (
              <Badge variant="default" className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </Button>
        </Link>
      );
    },
    [isActive, getTranslatedLabel],
  );

  // Render navigation list with groups
  const renderNavigation = () => (
    <nav className="space-y-1">
      {visibleItems.map((item, index) => {
        const isStandalone = standaloneItems.has(item.id);
        const hasChildren = item.children && item.children.length > 0;

        // Standalone item with separator
        if (isStandalone && !hasChildren) {
          return (
            <React.Fragment key={item.id}>
              {index > 0 && <div className="my-4 border-t border-border" />}
              {renderNavItem(item)}
            </React.Fragment>
          );
        }

        // Group with children
        if (hasChildren) {
          const icon = item.icon || iconMap[item.id];
          const label = getTranslatedLabel(item);
          const filteredChildren = item.children!.filter((child) => {
            if (child.disabled) return false;
            if (!child.permissions || child.permissions.length === 0) return true;
            return child.permissions.some((permission) => userPermissions.includes(permission));
          });

          if (filteredChildren.length === 0) return null;

          return (
            <div key={item.id} className={cn('space-y-1', index > 0 && 'mt-5')}>
              {/* Group header */}
              <div className="flex items-center gap-2 px-3 py-2">
                {icon && <span className="h-4 w-4 text-muted-foreground">{icon}</span>}
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
              </div>
              {/* Group children */}
              <div className="space-y-0.5 pl-2">
                {filteredChildren.map((child) => renderNavItem(child))}
              </div>
            </div>
          );
        }

        // Regular standalone item without separator
        return (
          <React.Fragment key={item.id}>
            {renderNavItem(item)}
          </React.Fragment>
        );
      })}
    </nav>
  );

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
            <div className="mt-6">{renderNavigation()}</div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Navigation - Fixed Panel */}
      <aside
        className={cn(
          'hidden md:flex md:w-64 md:flex-col md:fixed md:top-14 md:bottom-0 md:z-30',
          className,
        )}
      >
        <div className="flex flex-col flex-grow pt-5 bg-background border-r overflow-y-auto">
          <div className="flex-grow px-4 pb-4">{renderNavigation()}</div>
        </div>
      </aside>
    </>
  );
}

Sidebar.displayName = 'Sidebar';

/**
 * SidebarTrigger - Mobile menu trigger button
 * Exported separately for use in headers
 */
export function SidebarTrigger({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button variant="ghost" size="icon" className={cn('md:hidden', className)} onClick={onClick}>
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle navigation menu</span>
    </Button>
  );
}
