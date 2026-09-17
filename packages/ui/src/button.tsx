import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:outline-ring shadow-sm',
        secondary:
          'bg-accent-soft text-foreground hover:bg-accent-soft/80 focus-visible:outline-accent',
        outline:
          'border border-border bg-surface text-foreground hover:bg-surface-muted focus-visible:outline-ring',
        ghost: 'text-foreground hover:bg-surface-muted focus-visible:outline-ring',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-destructive',
        accent:
          'bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:outline-ring shadow-sm',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} type={type} {...props} />
  );
}

export { buttonVariants };
