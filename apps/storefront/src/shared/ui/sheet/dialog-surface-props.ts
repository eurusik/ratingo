import type { ReactElement, ReactNode } from 'react';

type PressableElement = ReactElement<{ onPress?: () => void }>;

type SheetSize = 'content' | 'full';

export interface DialogSurfaceProps {
  trigger?: PressableElement;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  title: string;
  isHeaderless?: boolean;
  isWide?: boolean;
  size?: SheetSize;
  footer?: ReactNode;
  children: ReactNode;
}
