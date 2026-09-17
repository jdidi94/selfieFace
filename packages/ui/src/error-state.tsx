import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export type ErrorStateProps = {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-destructive/30 bg-surface px-6 py-8 text-center',
        className,
      )}
      role="alert"
    >
      <h3 className="text-base font-medium text-destructive">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
