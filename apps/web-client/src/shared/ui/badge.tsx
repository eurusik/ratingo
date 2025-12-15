/**
 * Badge component for labels and status indicators.
 *
 * Supports multiple variants and optional positioning.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Flame } from 'lucide-react';
import { cn } from '@/shared/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold',
  {
    variants: {
      variant: {
        default: 'bg-zinc-800 text-white',
        rank: 'bg-yellow-400 text-black',
        trending: 'bg-red-600 text-white',
        new: 'bg-green-500 text-white',
        info: 'bg-blue-500 text-white',
      },
      position: {
        static: '',
        'top-left': 'absolute top-2 left-2',
        'top-right': 'absolute top-2 right-2',
        'bottom-left': 'absolute bottom-2 left-2',
        'bottom-right': 'absolute bottom-2 right-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      position: 'static',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Show flame icon for trending variant. */
  showIcon?: boolean;
}

/**
 * Badge component for status and labels.
 *
 * @example
 * <Badge variant="rank" position="top-left">№1</Badge>
 * <Badge variant="trending" showIcon>ХІТ</Badge>
 */
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, position, showIcon = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, position, className }))}
        {...props}
      >
        {variant === 'trending' && showIcon && <Flame className="h-3 w-3" />}
        {children}
      </div>
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
