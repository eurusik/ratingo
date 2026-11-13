import type { ReactElement, ReactNode } from 'react';

export type PressableElement = ReactElement<{ onPress?: () => void }>;

type SheetSize = 'content' | 'full';

export interface DialogSurfaceProps {
  trigger?: PressableElement;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  title: string;
  size?: SheetSize;
  footer?: ReactNode;
  children: ReactNode;
}
