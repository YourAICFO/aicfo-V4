import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Card variants for different styles
const cardVariants = cva(
  'rounded-lg border transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 hover:shadow-md',
        subtle: 'bg-slate-50 border-slate-200 shadow-sm dark:bg-slate-900/40 dark:border-slate-700',
        critical: 'bg-red-50 border-red-200 shadow-sm dark:bg-red-900/20 dark:border-red-800',
        elevated: 'bg-white border-gray-200 shadow-md hover:shadow-lg dark:bg-gray-800 dark:border-gray-700',
        flat: 'bg-white border-gray-200 shadow-none dark:bg-gray-800 dark:border-gray-700',
        gradient: 'bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-sm dark:from-gray-800 dark:to-gray-800/80 dark:border-gray-700',
        dark: 'bg-gray-900 border-gray-700 text-white',
        success: 'bg-gradient-to-br from-white to-green-50 border-green-200 shadow-sm dark:from-gray-800 dark:to-green-900/20 dark:border-green-800',
        warning: 'bg-gradient-to-br from-white to-amber-50 border-amber-200 shadow-sm dark:from-gray-800 dark:to-amber-900/20 dark:border-amber-800',
        error: 'bg-gradient-to-br from-white to-red-50 border-red-200 shadow-sm dark:from-gray-800 dark:to-red-900/20 dark:border-red-800',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
      border: {
        default: 'border',
        none: 'border-0',
        thick: 'border-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
      border: 'default',
    },
  }
);

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cardVariants> {
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, border, children, ...props }, ref) => {
    const finalClassName = cn(
      cardVariants({ variant, padding, border }),
      className
    );

    return (
      <div className={finalClassName} ref={ref} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5', className)}
      {...props}
    >
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

// Card Title
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

// Card Description
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-gray-600 dark:text-gray-400', className)}
      {...props}
    >
      {children}
    </p>
  )
);
CardDescription.displayName = 'CardDescription';

// Card Content
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('pt-0', className)} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

// Card Footer
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-0', className)}
      {...props}
    >
      {children}
    </div>
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
