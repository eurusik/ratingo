import { AdminLayout } from '../../modules/admin'
import { redirect } from 'next/navigation'

// TODO: Replace with real auth check
async function checkAdminAccess() {
  // For now, allow access - replace with real auth logic
  return true
}

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const hasAccess = await checkAdminAccess()
  
  if (!hasAccess) {
    redirect('/')
  }

  // TODO: Get user permissions from auth system
  const userPermissions = [
    'admin.policies.read',
    'admin.runs.read'
  ]

  return (
    <AdminLayout userPermissions={userPermissions}>
      {children}
    </AdminLayout>
  )
}