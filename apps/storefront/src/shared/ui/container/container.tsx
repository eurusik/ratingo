import type { HTMLAttributes } from 'react';
import { cn } from '@ratingo/web-core/lib';

type ContainerElement = 'div' | 'section' | 'header' | 'footer' | 'nav';

interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ContainerElement;
}

export function Container({ as: Component = 'div', className, ...props }: ContainerProps) {
  return <Component className={cn('page-container', className)} {...props} />;
}
