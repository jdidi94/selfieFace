import Image from 'next/image';

/** Admin chrome: emblem + Selfieface word (light UI). */
export function AdminBrandMark({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={className ?? 'inline-flex items-center gap-2.5'}>
      <Image
        src="/brand/mark.png"
        alt=""
        width={40}
        height={40}
        className={compact ? 'h-7 w-7 object-contain' : 'h-8 w-8 object-contain'}
        aria-hidden
        priority
      />
      <span
        className={
          compact
            ? 'font-display text-xl text-foreground'
            : 'font-display text-2xl text-foreground'
        }
      >
        Selfieface
      </span>
    </span>
  );
}
