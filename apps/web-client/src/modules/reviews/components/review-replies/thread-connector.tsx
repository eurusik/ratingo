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

  return (
    <>
      {/* Vertical line segment - connects to next sibling */}
      {showVerticalLine && (
        <div className="absolute -left-5 top-0 bottom-0 w-0.5 bg-cinema-border" />
      )}

      {/* Curved hook ╰ pointing to content */}
      <div className={`absolute -left-5 top-0 w-4 ${hookHeight}`}>
        <div className="w-full h-full border-l-2 border-b-2 border-cinema-border rounded-bl-lg" />
      </div>
    </>
  );
}
