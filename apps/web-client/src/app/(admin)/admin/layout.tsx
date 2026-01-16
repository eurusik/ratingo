import { AdminLayout } from '@/modules/admin';

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  // Auth check is handled client-side in AdminLayout component
  // Permissions will be derived from user role
  const userPermissions = ['admin.policies.read', 'admin.runs.read', 'admin.providers.read', 'admin.journal.read', 'admin.reports.read'];

  return <AdminLayout userPermissions={userPermissions}>{children}</AdminLayout>;
}
