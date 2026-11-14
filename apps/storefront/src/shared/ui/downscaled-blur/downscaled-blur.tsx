import type { ReactNode } from 'react';

export function DownscaledBlur({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="absolute top-0 left-0 size-[12.5%] origin-top-left scale-800 blur-[5px]"
    >
      {children}
    </span>
  );
}
