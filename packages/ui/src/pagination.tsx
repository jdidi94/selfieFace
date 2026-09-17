import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { Button } from './button';
import { cn } from './lib/cn';

export type PaginationProps = HTMLAttributes<HTMLElement> & {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ className, page, totalPages, onPageChange, ...props }: PaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      className={cn('flex items-center justify-center gap-2', className)}
      aria-label="Pagination"
      {...props}
    >
      <Button
        variant="outline"
        size="icon"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[6rem] text-center text-sm text-muted-foreground">
        Page {page} of {Math.max(totalPages, 1)}
      </span>
      <Button
        variant="outline"
        size="icon"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
