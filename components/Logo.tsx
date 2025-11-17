'use client';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />

      {/* Logo container */}
      <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
        <svg
          className="w-6 h-6 text-white"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Clean trending line */}
          <path
            d="M2 20L8 14L14 17L24 4"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw-line"
          />
        </svg>
      </div>
    </div>
  );
}
