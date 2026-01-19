/**
 * User menu component for header.
 * Shows login button or user avatar with dropdown.
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { User, LogOut, Settings, Bookmark, Shield, Play } from 'lucide-react';
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
  const { user, isAuthenticated, isLoading, isAdmin, logout } = useAuth();
  const { dict } = useTranslation();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-cinema-elevated animate-pulse" />;
  }

  if (!isAuthenticated) {
    return <Button onClick={openLogin}>{dict.auth.login}</Button>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
          <Avatar className="h-8 w-8">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} />}
            <AvatarFallback className="bg-cinema-border">
              <User className="w-4 h-4 text-cinema-text-muted" />
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-cinema-card border-cinema-borderSoft">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-cinema-text-primary">{user?.username}</p>
            <p className="text-xs text-cinema-text-muted">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-cinema-elevated" />
        <DropdownMenuItem asChild className="text-cinema-text-secondary focus:bg-cinema-elevated focus:text-cinema-text-primary">
          <Link href={'/saved' as Route}>
            <Bookmark className="w-4 h-4 mr-2" />
            {dict.auth.saved}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-cinema-text-secondary focus:bg-cinema-elevated focus:text-cinema-text-primary">
          <Link href={'/activity' as Route}>
            <Play className="w-4 h-4 mr-2" />
            {dict.auth.activity}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-cinema-text-secondary focus:bg-cinema-elevated focus:text-cinema-text-primary">
          <Link href={'/settings' as Route}>
            <Settings className="w-4 h-4 mr-2" />
            {dict.auth.settings}
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator className="bg-cinema-elevated" />
            <DropdownMenuItem
              asChild
              className="text-cinema-text-secondary focus:bg-cinema-elevated focus:text-cinema-text-primary"
            >
              <Link href={'/admin' as Route}>
                <Shield className="w-4 h-4 mr-2" />
                {dict.auth.admin}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="bg-cinema-elevated" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-400 focus:bg-cinema-elevated focus:text-red-300"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {dict.auth.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
