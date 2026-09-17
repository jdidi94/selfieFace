import type { HTMLAttributes } from 'react';
import { cn } from './lib/cn';

export function Spinner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary',
        className,
      )}
      role="status"
      aria-label="Loading"
      {...props}
    />
  );
}

export type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

export function LoadingState({ className, label = 'Loading…', ...props }: LoadingStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground', className)}
      {...props}
    >
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}
