/**
 * Centralized number formatting for Layer 1.
 * Null/undefined/NaN → "—". Consistent INR, variance, and percentage handling.
 */

const NULL_DISPLAY = '—';

function isNullish(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));
}

/**
 * Format as INR. null/undefined/NaN → "—". Negative values show as "-₹X".
 */
export function formatCurrency(value: number | null | undefined): string {
  if (isNullish(value)) return NULL_DISPLAY;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format number with thousands separator. null/undefined/NaN → "—".
 * Optional suffix e.g. "d" for days.
 */
export function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (isNullish(value)) return NULL_DISPLAY;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return suffix ? `${formatted}${suffix}` : formatted;
}

/**
 * Format as percentage. null/undefined/NaN → "—". Max 1 decimal, append "%".
 */
export function formatPercentage(value: number | null | undefined): string {
  if (isNullish(value)) return NULL_DISPLAY;
  const fixed = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(1));
  return `${fixed}%`;
}

/**
 * Format variance amount for display. null/undefined/NaN → "—".
 * Negative styling (e.g. text-red-600) is applied by the component.
 */
export function formatVarianceAmount(value: number | null | undefined): string {
  if (isNullish(value)) return NULL_DISPLAY;
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return value >= 0 ? `+${formatted}` : formatted;
}

/**
 * Format variance percentage. null/undefined/NaN or denominator zero → "—".
 * Caller may pass denominator to treat zero denominator as "—".
 */
export function formatVariancePct(value: number | null | undefined, _denominator?: number): string {
  if (isNullish(value)) return NULL_DISPLAY;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value.toFixed(1))}%`;
}
