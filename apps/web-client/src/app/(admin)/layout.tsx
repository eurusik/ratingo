/**
 * Layout for admin pages without public Header/Footer.
 */

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <>{children}</>;
}
