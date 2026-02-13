/**
 * AI CFO Design System - Design Tokens
 * Modern, professional design system for financial applications
 */

// Color Palette - Modern Financial Theme
export const Colors = {
  // Primary Brand Colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main brand color
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },

  // Success/Positive Financial
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // Main success
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },

  // Warning/Attention
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // Main warning
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  // Error/Danger
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // Main error
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Neutral Grays
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a', // Main gray
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b',
  },

  // Background Colors
  background: {
    light: '#ffffff',
    dark: '#0f172a', // slate-900
    lightSecondary: '#f8fafc', // slate-50
    darkSecondary: '#1e293b', // slate-800
  },

  // Text Colors
  text: {
    light: {
      primary: '#0f172a', // slate-900
      secondary: '#475569', // slate-600
      tertiary: '#64748b', // slate-500
      inverse: '#ffffff',
    },
    dark: {
      primary: '#f8fafc', // slate-50
      secondary: '#cbd5e1', // slate-300
      tertiary: '#94a3b8', // slate-400
      inverse: '#0f172a', // slate-900
    },
  },

  // Semantic Colors
  semantic: {
    positive: '#10b981', // emerald-500
    negative: '#ef4444', // red-500
    neutral: '#6b7280', // gray-500
    info: '#3b82f6', // blue-500
  },
};

// Typography - Modern Financial Typography
export const Typography = {
  fontFamily: {
    sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
    mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
  },

  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },

  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

// Spacing - Consistent spacing system
export const Spacing = {
  0: '0px',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  32: '8rem',     // 128px
  40: '10rem',    // 160px
  48: '12rem',    // 192px
  56: '14rem',    // 224px
  64: '16rem',    // 256px
};

// Shadows - Modern elevation system
export const Shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none',
};

// Border Radius - Modern rounded corners
export const BorderRadius = {
  none: '0px',
  sm: '0.125rem',   // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
};

// Transitions - Smooth animations
export const Transitions = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  easing: {
    ease: 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
  },
};

// Z-Index - Layer management
export const ZIndex = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
};

// Breakpoints - Responsive design
export const Breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Dark Mode Support
export const DarkMode = {
  className: 'dark',
  selector: ':root.dark',
  mediaQuery: '(prefers-color-scheme: dark)',
};

// Animation Presets
export const Animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: Transitions.duration.normal, easing: Transitions.easing.ease },
  },
  
  slideUp: {
    initial: { opacity: 0, transform: 'translateY(10px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    transition: { duration: Transitions.duration.normal, easing: Transitions.easing.ease },
  },
  
  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    transition: { duration: Transitions.duration.fast, easing: Transitions.easing.ease },
  },
  
  shimmer: {
    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
};

// CSS Custom Properties Generator
export const generateCSSCustomProperties = () => {
  return `
    :root {
      /* Colors */
      --color-primary-50: ${Colors.primary[50]};
      --color-primary-500: ${Colors.primary[500]};
      --color-primary-900: ${Colors.primary[900]};
      
      --color-success-500: ${Colors.success[500]};
      --color-warning-500: ${Colors.warning[500]};
      --color-error-500: ${Colors.error[500]};
      
      /* Typography */
      --font-family-sans: ${Typography.fontFamily.sans.join(', ')};
      --font-size-base: ${Typography.fontSize.base};
      --font-weight-medium: ${Typography.fontWeight.medium};
      --line-height-normal: ${Typography.lineHeight.normal};
      
      /* Spacing */
      --spacing-1: ${Spacing[1]};
      --spacing-4: ${Spacing[4]};
      --spacing-8: ${Spacing[8]};
      
      /* Shadows */
      --shadow-sm: ${Shadows.sm};
      --shadow-default: ${Shadows.DEFAULT};
      --shadow-lg: ${Shadows.lg};
      
      /* Border Radius */
      --border-radius-sm: ${BorderRadius.sm};
      --border-radius-default: ${BorderRadius.DEFAULT};
      --border-radius-lg: ${BorderRadius.lg};
      
      /* Transitions */
      --transition-duration-fast: ${Transitions.duration.fast};
      --transition-duration-normal: ${Transitions.duration.normal};
      --transition-easing-ease: ${Transitions.easing.ease};
      
      /* Dark Mode Colors */
      --color-bg-dark: ${Colors.background.dark};
      --color-bg-dark-secondary: ${Colors.background.darkSecondary};
      --color-text-dark-primary: ${Colors.text.dark.primary};
      --color-text-dark-secondary: ${Colors.text.dark.secondary};
    }
    
    .dark {
      --color-bg-primary: ${Colors.background.dark};
      --color-bg-secondary: ${Colors.background.darkSecondary};
      --color-text-primary: ${Colors.text.dark.primary};
      --color-text-secondary: ${Colors.text.dark.secondary};
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
};

// Utility Functions
export const Utils = {
  // Convert hex to RGB
  hexToRgb: (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  },

  // Convert hex to RGBA
  hexToRgba: (hex: string, alpha: number) => {
    const rgb = Utils.hexToRgb(hex);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : null;
  },

  // Generate gradient from two colors
  generateGradient: (color1: string, color2: string, angle: number = 135) => {
    return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
  },

  // Get contrasting text color
  getContrastColor: (hexColor: string) => {
    const rgb = Utils.hexToRgb(hexColor);
    if (!rgb) return '#000000';
    
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  },
};

// Export all design tokens
export default {
  Colors,
  Typography,
  Spacing,
  Shadows,
  BorderRadius,
  Transitions,
  ZIndex,
  Breakpoints,
  DarkMode,
  Animations,
  Utils,
  generateCSSCustomProperties,
};