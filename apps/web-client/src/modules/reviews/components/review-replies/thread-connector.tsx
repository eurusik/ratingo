'use client';

interface ThreadConnectorProps {
  /** Show vertical line connecting to next sibling */
  showVerticalLine?: boolean;
  /** Type of connector - affects hook size */
  variant?: 'default' | 'small';
}

/**
 * Visual thread connector with vertical line and curved hook.
 * Used to show reply threading hierarchy.
 */
export function ThreadConnector({
  showVerticalLine = false,
  variant = 'default',
}: ThreadConnectorProps) {
  const hookHeight = variant === 'small' ? 'h-4' : 'h-5';

  // Use subtle color for thread lines to reduce visual weight
  const lineColor = 'border-cinema-borderSoft/40';
  const bgColor = 'bg-cinema-borderSoft/40';

  return (
    <>
      {/* Vertical line segment - connects to next sibling */}
      {showVerticalLine && (
        <div className={`absolute -left-5 top-0 bottom-0 w-px ${bgColor}`} />
      )}

      {/* Curved hook ╰ pointing to content */}
      <div className={`absolute -left-5 top-0 w-4 ${hookHeight}`}>
        <div className={`w-full h-full border-l border-b ${lineColor} rounded-bl-lg`} />
      </div>
    </>
  );
}
