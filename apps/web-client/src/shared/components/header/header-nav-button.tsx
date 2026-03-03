'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui';
import { useAuth } from '@/core/auth';
import { cn } from '@/shared/utils';

interface HeaderNavButtonProps {
  icon: LucideIcon;
  label: string;
  href: string;
}

export function HeaderNavButton({ icon: Icon, label, href }: HeaderNavButtonProps) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated) {
    return null;
  }

  const isActive = pathname.startsWith(href);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hidden md:inline-flex h-9 w-9 rounded-full transition-colors',
              isActive
                ? 'text-white'
                : 'text-cinema-text-muted hover:text-white hover:bg-cinema-elevated',
            )}
            asChild
          >
            <Link href={href as Route} aria-label={label}>
              <Icon className="h-5 w-5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
