'use client';

interface LoadMoreProps {
  onLoadMore: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function LoadMore({
  onLoadMore,
  loading = false,
  disabled = false,
  className = '',
}: LoadMoreProps) {
  return (
    <div className={`text-center mt-8 ${className}`}>
      <button
        onClick={onLoadMore}
        disabled={loading || disabled}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Завантаження...' : 'Завантажити більше'}
      </button>
    </div>
  );
}
