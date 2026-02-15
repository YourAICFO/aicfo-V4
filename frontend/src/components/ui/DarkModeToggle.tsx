import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DarkModeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ 
  className, 
  size = 'md', 
  showLabel = false 
}) => {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle theme changes
  useEffect(() => {
    // Check if dark mode is saved in localStorage
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Set initial theme
    const initialTheme = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(initialTheme);
    
    // Apply theme to document
    if (initialTheme) {
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.dataset.theme = 'light';
    }
    
    setMounted(true);
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    // Apply to document
    if (newTheme) {
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.dataset.theme = 'light';
      localStorage.setItem('theme', 'light');
    }
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { isDark: newTheme } }));
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg bg-gray-200 p-2 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600',
          size === 'sm' && 'p-1.5',
          size === 'lg' && 'p-2.5',
          className
        )}
        aria-label="Toggle dark mode"
        disabled
      >
        <div className="h-4 w-4 animate-pulse rounded-full bg-gray-400" />
      </button>
    );
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const buttonSizes = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-2.5 text-base',
  };

  return (
    <button
      onClick={toggleDarkMode}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all duration-200',
        'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600',
        'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100',
        'border border-transparent hover:border-gray-300 dark:hover:border-gray-500',
        'shadow-sm hover:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        buttonSizes[size],
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      <div className="relative">
        <Sun className={cn(
          iconSizes[size],
          'transition-all duration-200',
          isDark ? 'rotate-90 scale-0' : 'rotate-0 scale-100'
        )} />
        <Moon className={cn(
          iconSizes[size],
          'absolute inset-0 transition-all duration-200',
          isDark ? 'rotate-0 scale-100' : '-rotate-90 scale-0'
        )} />
      </div>
      
      {showLabel && (
        <span className="ml-2 font-medium">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};

// Hook for components that need to know the current theme
export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    // Initial check
    checkTheme();

    // Listen for theme changes
    const handleThemeChange = (event: CustomEvent<{ isDark: boolean }>) => {
      setIsDark(event.detail.isDark);
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);
    
    // Also listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => checkTheme();
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  return { isDark };
}

// Global dark mode styles - use a separate CSS file or inline styles
export const GlobalDarkModeStyles = () => {
  // Apply styles directly to document head
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --color-bg-light: #ffffff;
        --color-bg-light-secondary: #f8fafc;
        --color-text-light-primary: #0f172a;
        --color-text-light-secondary: #475569;
        --color-text-light-tertiary: #64748b;
        
        --color-bg-dark: #0f172a;
        --color-bg-dark-secondary: #1e293b;
        --color-text-dark-primary: #f8fafc;
        --color-text-dark-secondary: #cbd5e1;
        --color-text-dark-tertiary: #94a3b8;
      }

      .dark {
        color-scheme: dark;
      }

      /* Dark mode transitions */
      * {
        transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
      }

      /* Dark mode backgrounds */
      .dark .bg-white {
        background-color: var(--color-bg-dark);
      }

      .dark .bg-gray-50 {
        background-color: var(--color-bg-dark-secondary);
      }

      .dark .bg-gray-100 {
        background-color: #334155;
      }

      /* Dark mode text colors */
      .dark .text-gray-900 {
        color: var(--color-text-dark-primary);
      }

      .dark .text-gray-700 {
        color: var(--color-text-dark-secondary);
      }

      .dark .text-gray-600 {
        color: var(--color-text-dark-tertiary);
      }

      .dark .text-gray-500 {
        color: #94a3b8;
      }

      /* Dark mode borders */
      .dark .border-gray-200 {
        border-color: #334155;
      }

      .dark .border-gray-300 {
        border-color: #475569;
      }

      /* Dark mode form elements */
      .dark input,
      .dark select,
      .dark textarea {
        background-color: #1e293b;
        border-color: #475569;
        color: #f8fafc;
      }

      .dark input::placeholder,
      .dark select::placeholder,
      .dark textarea::placeholder {
        color: #94a3b8;
      }

      /* Dark mode shadows */
      .dark .shadow-sm {
        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.3);
      }

      .dark .shadow-md {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4);
      }

      .dark .shadow-lg {
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4);
      }

      /* Dark mode gradients */
      .dark .from-white {
        --tw-gradient-from: #1e293b;
        --tw-gradient-to: rgb(30 41 59 / 0);
        --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);
      }

      .dark .to-gray-50 {
        --tw-gradient-to: #334155;
      }

      /* Dark mode charts and graphs */
      .dark .recharts-default-tooltip {
        background-color: #1e293b !important;
        border-color: #475569 !important;
        color: #f8fafc !important;
      }

      .dark .recharts-tooltip-label {
        color: #f8fafc !important;
      }

      /* Dark mode for specific components */
      .dark .bg-emerald-50 {
        background-color: rgb(16 185 129 / 0.1);
      }

      .dark .bg-amber-50 {
        background-color: rgb(245 158 11 / 0.1);
      }

      .dark .bg-red-50 {
        background-color: rgb(239 68 68 / 0.1);
      }

      .dark .text-emerald-700 {
        color: #34d399;
      }

      .dark .text-amber-700 {
        color: #fbbf24;
      }

      .dark .text-red-700 {
        color: #f87171;
      }

      .dark .bg-emerald-100 {
        background-color: rgb(16 185 129 / 0.2);
      }

      .dark .bg-amber-100 {
        background-color: rgb(245 158 11 / 0.2);
      }

      .dark .bg-red-100 {
        background-color: rgb(239 68 68 / 0.2);
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
};

export default DarkModeToggle;
