/**
 * Empty state component for saved lists.
 */

import { Bookmark, HelpCircle, Bell } from 'lucide-react';

interface EmptyStateProps {
  type: 'forLater' | 'considering' | 'notifications';
  title: string;
  description: string;
}

const icons = {
  forLater: Bookmark,
  considering: HelpCircle,
  notifications: Bell,
};

export function EmptyState({ type, title, description }: EmptyStateProps) {
  const Icon = icons[type];

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center min-h-[400px]">
      <div className="w-20 h-20 rounded-full bg-zinc-800/30 border border-zinc-700/50 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-zinc-500" />
      </div>
      <h3 className="text-xl font-medium text-zinc-200 mb-3">{title}</h3>
      <p className="text-base text-zinc-500 max-w-md leading-relaxed">{description}</p>
    </div>
  );
}
