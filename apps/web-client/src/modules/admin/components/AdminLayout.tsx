'use client';

import { useEffect, useRef } from 'react';
import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/core/auth';
import { AdminShell, getAdminNavigation } from '../';
import { BreadcrumbItem } from '../types';

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

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    if (!isRedirecting.current) {
      isRedirecting.current = true;
      router.push('/');
    }
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
