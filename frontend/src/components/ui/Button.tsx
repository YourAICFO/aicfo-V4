import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Button variants using class-variance-authority
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md',
        secondary: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 focus:ring-gray-500 shadow-sm',
        success: 'bg-success-600 text-white hover:bg-success-700 focus:ring-success-500 shadow-sm',
        warning: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500 shadow-sm',
        error: 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500 shadow-sm',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
        outline: 'bg-transparent text-primary-600 hover:bg-primary-50 border border-primary-600 focus:ring-primary-500',
      },
      size: {
        xs: 'px-2 py-1 text-xs',
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
        xl: 'px-8 py-4 text-lg',
        icon: 'p-2',
      },
      shape: {
        square: '',
        rounded: 'rounded-full',
        pill: 'rounded-full',
      },
      state: {
        default: '',
        loading: 'opacity-75 cursor-not-allowed',
        disabled: 'opacity-50 cursor-not-allowed',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'square',
      state: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, state, asChild = false, loading = false, leftIcon, rightIcon, fullWidth = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : 'button';
    
    const finalState = loading ? 'loading' : disabled ? 'disabled' : state;
    const finalClassName = cn(
      buttonVariants({ variant, size, shape, state: finalState }),
      fullWidth && 'w-full',
      className
    );

    if (asChild) {
      return (
        <Comp className={finalClassName} ref={ref} disabled={disabled || loading} {...props}>
          {leftIcon && <span className="mr-2">{leftIcon}</span>}
          {loading && (
            <span className="mr-2 inline-block">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
          )}
          {children}
          {rightIcon && <span className="ml-2">{rightIcon}</span>}
        </Comp>
      );
    }

    return (
      <Comp
        className={finalClassName}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {leftIcon && <span className="mr-2">{leftIcon}</span>}
        {loading && (
          <span className="mr-2 inline-block">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>
        )}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };