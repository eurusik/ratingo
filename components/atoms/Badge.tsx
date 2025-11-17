import { Flame } from 'lucide-react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'rank' | 'trending' | 'info';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

export function Badge({ children, variant = 'info', position, className = '' }: BadgeProps) {
  const variantClasses = {
    rank: 'bg-yellow-400 text-black',
    trending: 'bg-red-600 text-white flex items-center gap-1',
    info: 'bg-zinc-800 text-white',
  };

  const positionClasses = position
    ? {
        'top-left': 'absolute top-2 left-2',
        'top-right': 'absolute top-2 right-2',
        'bottom-left': 'absolute bottom-2 left-2',
        'bottom-right': 'absolute bottom-2 right-2',
      }[position]
    : '';

  return (
    <div
      className={`${variantClasses[variant]} text-xs font-bold px-2 py-1 rounded-full ${positionClasses} ${className}`}
    >
      {variant === 'trending' && <Flame className="w-3 h-3" />}
      {children}
    </div>
  );
}
