/**
 * Admin navigation configuration
 */

import { NavigationItem } from './types'

export const ADMIN_NAVIGATION: NavigationItem[] = [
  {
    id: 'policies',
    label: 'Політики', // Fallback label, will be translated
    href: '/admin/policies',
    permissions: ['admin.policies.read']
  },
  {
    id: 'runs',
    label: 'Запуски оцінювання', // Fallback label, will be translated
    href: '/admin/runs',
    permissions: ['admin.runs.read']
  }
]

/**
 * Get admin navigation filtered by user permissions
 */
export function getAdminNavigation(userPermissions: string[] = []): NavigationItem[] {
  return ADMIN_NAVIGATION.filter(item => {
    if (!item.permissions || item.permissions.length === 0) {
      return true
    }
    return item.permissions.some(permission => userPermissions.includes(permission))
  })
}