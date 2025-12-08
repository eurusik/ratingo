'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const res = await fetch('/api/admin/logout', {
        method: 'POST',
      });

      if (res.ok) {
        router.push('/admin/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <Button variant="outline" onClick={handleLogout} className="gap-2">
      <LogOut className="w-4 h-4" />
      Вийти
    </Button>
  );
}
