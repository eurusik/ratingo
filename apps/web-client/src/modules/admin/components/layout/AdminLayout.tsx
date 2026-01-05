'use client';

import { useEffect, useRef } from 'react';
import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/core/auth';
import { AdminShell } from './AdminShell';
import { getAdminNavigation } from '../../config';
import { BreadcrumbItem } from '../../types';

interface AdminLayoutProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  headerActions?: ReactNode;
  userPermissions?: string[];
}

/**
 * Standard admin layout wrapper with role-based access control.
 * Redirects non-admin users to home page.
 */
export function AdminLayout({
  children,
  breadcrumbs = [],
  headerActions,
  userPermissions = [],
}: AdminLayoutProps) {
  const router = useRouter();
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const navigation = getAdminNavigation(userPermissions);
  const isRedirecting = useRef(false);

  const shouldRedirect = !isLoading && (!isAuthenticated || !isAdmin);

  // Listen for 403 forbidden events
  useEffect(() => {
    const handleForbidden = () => {
      if (isRedirecting.current) return;
      isRedirecting.current = true;
      router.push('/');
    };
    window.addEventListener('auth:forbidden', handleForbidden);
    return () => window.removeEventListener('auth:forbidden', handleForbidden);
  }, [router]);

  // Redirect non-admin users (must be in useEffect, not render phase)
  useEffect(() => {
    if (shouldRedirect && !isRedirecting.current) {
      isRedirecting.current = true;
      router.push('/');
    }
  }, [shouldRedirect, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Don't render admin content if not authorized
  if (shouldRedirect) {
    return null;
  }

  return (
    <AdminShell
      navigationItems={navigation}
      showSidebar={true}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      userPermissions={userPermissions}
    >
      {children}
    </AdminShell>
  );
}
