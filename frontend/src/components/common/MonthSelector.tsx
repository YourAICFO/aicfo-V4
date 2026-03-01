import React from 'react';

export function formatMonthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

interface MonthSelectorProps {
  availableMonths: string[];
  value: string;
  onChange: (month: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
  label?: string;
  className?: string;
  selectClassName?: string;
}

/**
 * Month selector for reporting period (e.g. FY 24-25). Use snapshotLatestMonthKey or pl-months as default.
 */
export const MonthSelector: React.FC<MonthSelectorProps> = ({
  availableMonths,
  value,
  onChange,
  disabled = false,
  disabledMessage,
  label = 'Month',
  className = '',
  selectClassName = 'rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60',
}) => {
  const options = availableMonths.map((m) => ({ value: m, label: formatMonthLabel(m) }));
  const isNoData = availableMonths.length === 0;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <select
          className={selectClassName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isNoData}
        >
          {options.length === 0 ? (
            <option value="">No months</option>
          ) : (
            options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          )}
        </select>
      </div>
      {disabledMessage && (disabled || isNoData) && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{disabledMessage}</p>
      )}
    </div>
  );
};
