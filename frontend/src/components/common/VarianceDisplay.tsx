import React from 'react';
import { formatVarianceAmount, formatVariancePct } from '../../lib/format';

interface VarianceDisplayProps {
  amount?: number | null;
  pct?: number | null;
  /** Optional suffix e.g. " vs prev" */
  suffix?: string;
  /** When true, positive amount is styled red (e.g. opex increase = bad) */
  inverse?: boolean;
  className?: string;
}

/**
 * Reusable variance: "₹X (Y%)". Negative → text-red-600; positive → neutral; null → "—".
 */
export default function VarianceDisplay({ amount, pct, suffix = '', inverse = false, className = '' }: VarianceDisplayProps) {
  const amountStr = formatVarianceAmount(amount);
  const pctStr = formatVariancePct(pct);
  const isNull = amount == null && pct == null;
  if (isNull || (amountStr === '—' && pctStr === '—')) {
    return <span className={className}>—</span>;
  }
  const isNegative = typeof amount === 'number' && amount < 0;
  const isRed = inverse ? (typeof amount === 'number' && amount > 0) : isNegative;
  const colorClass = isRed ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300';
  return (
    <span className={`${colorClass} ${className}`.trim()}>
      {amountStr}
      {pctStr !== '—' && ` (${pctStr})`}
      {suffix}
    </span>
  );
}
