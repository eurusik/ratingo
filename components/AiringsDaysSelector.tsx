import React from 'react';

export function AiringsDaysSelector({
  days,
  onChange,
  disabled,
}: {
  days: number;
  onChange: (d: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center space-x-3">
      <select
        value={days}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="bg-zinc-800 text-white px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={disabled}
      >
        <option value={7}>7 днів</option>
        <option value={14}>14 днів</option>
        <option value={30}>30 днів</option>
      </select>
    </div>
  );
}
