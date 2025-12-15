/**
 * Card component with hover effects.
 *
 * Base card container with consistent styling.
 */

import * as React from 'react';
import { cn } from '@/shared/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Card container with glass morphism effect.
 *
 * @example
 * <Card className="p-4">
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'group relative rounded-xl bg-zinc-900/50 backdrop-blur overflow-hidden',
      'transition-all duration-300',
      'hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20',
      'hover:ring-2 hover:ring-blue-500/50',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-semibold text-white leading-tight tracking-tight',
        'group-hover:text-blue-400 transition-colors',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
