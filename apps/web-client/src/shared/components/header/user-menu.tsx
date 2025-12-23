/**
 * User menu component for header.
 * Shows login button or user avatar with dropdown.
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { User, LogOut, Settings, Bookmark } from 'lucide-react';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import {
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/shared/ui';

export function UserMenu() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { dict } = useTranslation();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <Button onClick={openLogin}>
        {dict.auth.login}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
          <Avatar className="h-8 w-8">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} />}
            <AvatarFallback className="bg-zinc-700">
              <User className="w-4 h-4 text-zinc-400" />
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-zinc-100">{user?.username}</p>
            <p className="text-xs text-zinc-500">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem asChild className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
          <Link href={'/saved' as Route}>
            <Bookmark className="w-4 h-4 mr-2" />
            {dict.auth.saved}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
          <Link href={'/settings' as Route}>
            <Settings className="w-4 h-4 mr-2" />
            {dict.auth.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-400 focus:bg-zinc-800 focus:text-red-300"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {dict.auth.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
