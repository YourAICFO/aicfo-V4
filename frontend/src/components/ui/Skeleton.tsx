import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Skeleton variants for different shapes and sizes
const skeletonVariants = cva(
  'animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
  {
    variants: {
      variant: {
        text: 'h-4 w-full',
        circular: 'rounded-full',
        rectangular: 'rounded-md',
        rounded: 'rounded-lg',
        pill: 'rounded-full',
      },
      size: {
        xs: 'h-2',
        sm: 'h-3',
        md: 'h-4',
        lg: 'h-5',
        xl: 'h-6',
        '2xl': 'h-8',
        '3xl': 'h-10',
        '4xl': 'h-12',
        '5xl': 'h-16',
      },
      width: {
        full: 'w-full',
        half: 'w-1/2',
        third: 'w-1/3',
        quarter: 'w-1/4',
        threeQuarters: 'w-3/4',
        xs: 'w-8',
        sm: 'w-16',
        md: 'w-24',
        lg: 'w-32',
        xl: 'w-48',
        '2xl': 'w-64',
        '3xl': 'w-80',
        '4xl': 'w-96',
        '5xl': 'w-128',
      },
    },
    defaultVariants: {
      variant: 'rectangular',
      size: 'md',
      width: 'full',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  count?: number;
  className?: string;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, size, width, count = 1, ...props }, ref) => {
    if (count > 1) {
      return (
        <div className="space-y-2">
          {[...Array(count)].map((_, index) => (
            <div
              key={index}
              className={cn(skeletonVariants({ variant, size, width }), className)}
              ref={index === 0 ? ref : undefined}
              {...props}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        className={cn(skeletonVariants({ variant, size, width }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export { Skeleton, skeletonVariants };