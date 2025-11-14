import React from 'react';

export function AiringsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-3 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-zinc-800 rounded" />
            <div className="h-4 bg-zinc-800 rounded w-48" />
          </div>
          <div className="h-4 bg-zinc-800 rounded w-24" />
        </div>
      ))}
    </div>
  );
}