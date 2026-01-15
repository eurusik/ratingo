/**
 * Admin navigation configuration
 */

import { NavigationItem } from './types';

export const ADMIN_NAVIGATION: NavigationItem[] = [
  {
    id: 'catalog',
    label: 'Каталог',
    href: '/admin/policies', // Default to first child
    children: [
      {
        id: 'policies',
        label: 'Політики',
        href: '/admin/policies',
        permissions: ['admin.policies.read'],
      },
      {
        id: 'runs',
        label: 'Запуски',
        href: '/admin/runs',
        permissions: ['admin.runs.read'],
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Інтеграції',
    href: '/admin/providers', // Default to first child
    children: [
      {
        id: 'providers',
        label: 'Провайдери',
        href: '/admin/providers',
        permissions: ['admin.providers.read'],
      },
    ],
  },
  {
    id: 'journal',
    label: 'Журнал',
    href: '/admin/journal',
    permissions: ['admin.journal.read'],
  },
];

/**
 * Get admin navigation filtered by user permissions
 */
export function getAdminNavigation(userPermissions: string[] = []): NavigationItem[] {
  return ADMIN_NAVIGATION.map((item) => {
    // Filter children by permissions
    if (item.children && item.children.length > 0) {
      const filteredChildren = item.children.filter((child) => {
        if (!child.permissions || child.permissions.length === 0) return true;
        return child.permissions.some((permission) => userPermissions.includes(permission));
      });

      // Only include group if it has visible children
      if (filteredChildren.length === 0) return null;

      return { ...item, children: filteredChildren };
    }

    // Filter standalone items by permissions
    if (!item.permissions || item.permissions.length === 0) return item;
    if (item.permissions.some((permission) => userPermissions.includes(permission))) return item;

    return null;
  }).filter((item): item is NavigationItem => item !== null);
}
