import { redirect } from 'next/navigation'

export default function AdminRootPage() {
  // Redirect to policies as the default admin page
  redirect('/admin/policies')
}