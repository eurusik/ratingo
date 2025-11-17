interface ProgressBarProps {
  current: number;
  total: number;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  current,
  total,
  color = 'blue',
  size = 'md',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, Math.round((current / total) * 100)));

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="text-xs text-gray-400 mb-1">
          {current}/{total}
        </div>
      )}
      <div className={`bg-zinc-800 rounded overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} rounded transition-all duration-300 ${sizeClasses[size]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
