import { cn } from './lib/cn';

export type RatingProps = {
  value: number;
  max?: number;
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
};

function Star({ filled, half }: { filled: boolean; half?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={cn(
        'h-[1em] w-[1em] shrink-0',
        filled ? 'text-accent' : half ? 'text-accent/40' : 'text-muted-foreground/30',
      )}
    >
      <path
        fill="currentColor"
        d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.77l-4.94 2.94.94-5.5-4-3.9 5.53-.8L10 1.5z"
      />
    </svg>
  );
}

export function Rating({ value, max = 5, count, size = 'sm', className }: RatingProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const fullStars = Math.floor(clamped);
  const hasHalf = clamped - fullStars >= 0.25 && clamped - fullStars < 0.85;
  const emptyStars = max - fullStars - (hasHalf ? 1 : 0);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 text-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className,
      )}
      aria-label={`Rated ${clamped.toFixed(1)} out of ${max}${count != null ? `, ${count} reviews` : ''}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: fullStars }, (_, i) => (
          <Star key={`f-${i}`} filled />
        ))}
        {hasHalf && <Star filled half />}
        {Array.from({ length: emptyStars }, (_, i) => (
          <Star key={`e-${i}`} filled={false} />
        ))}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {clamped.toFixed(1)}
        {count != null && count > 0 ? ` (${count})` : ''}
      </span>
    </div>
  );
}
