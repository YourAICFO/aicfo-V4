import React from 'react';

interface DataReadyBadgeProps {
  dataReady: boolean;
}

/**
 * Reusable badge: green "Data Ready" when true, amber "Data Incomplete" when false.
 * Pill style, small text, subtle background.
 */
export default function DataReadyBadge({ dataReady }: DataReadyBadgeProps) {
  if (dataReady) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        Data Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      Data Incomplete
    </span>
  );
}
