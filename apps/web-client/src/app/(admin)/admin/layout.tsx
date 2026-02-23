import { AdminLayout } from '@/modules/admin';

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  // TODO(#54): Derive permissions from server-side user role instead of hardcoding
  const userPermissions = ['admin.policies.read', 'admin.runs.read', 'admin.providers.read', 'admin.backfill.read', 'admin.journal.read', 'admin.reports.read'];

  return <AdminLayout userPermissions={userPermissions}>{children}</AdminLayout>;
}
