import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Card variants for different styles
const cardVariants = cva(
  'rounded-lg border transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white border-gray-200 shadow-sm hover:shadow-md',
        elevated: 'bg-white border-gray-200 shadow-md hover:shadow-lg',
        flat: 'bg-white border-gray-200 shadow-none',
        gradient: 'bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-sm',
        dark: 'bg-gray-900 border-gray-700 text-white',
        success: 'bg-gradient-to-br from-white to-green-50 border-green-200 shadow-sm',
        warning: 'bg-gradient-to-br from-white to-amber-50 border-amber-200 shadow-sm',
        error: 'bg-gradient-to-br from-white to-red-50 border-red-200 shadow-sm',
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
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, border, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : 'div';
    
    const finalClassName = cn(
      cardVariants({ variant, padding, border }),
      className
    );

    if (asChild) {
      return <Comp className={finalClassName} ref={ref} {...props}>{children}</Comp>;
    }

    return (
      <Comp className={finalClassName} ref={ref} {...props}>
        {children}
      </Comp>
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