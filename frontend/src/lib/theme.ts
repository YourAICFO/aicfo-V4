/**
 * Minimal fintech theme tokens. Use for impact/alerts/badges where hardcoded colors vary.
 * Do not over-engineer; Tailwind classes only.
 */
export const THEME = {
  surface: {
    default: 'bg-white dark:bg-gray-800',
    subtle: 'bg-slate-50 dark:bg-slate-900/40',
  },
  textMuted: 'text-slate-500 dark:text-slate-400',
  border: {
    default: 'border-gray-200 dark:border-gray-700',
    subtle: 'border-slate-200 dark:border-slate-700',
  },
  severity: {
    critical: 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10',
    high: 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-900/10',
    medium: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10',
    low: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10',
    neutral: 'border-l-gray-400 bg-gray-50 dark:bg-gray-800',
  },
} as const;
