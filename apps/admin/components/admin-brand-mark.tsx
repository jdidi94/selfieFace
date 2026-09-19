import Image from 'next/image';

/** Admin chrome: transparent Selfieface wordmark (no background plate). */
export function AdminBrandMark({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={className ?? 'inline-flex items-center'}>
      <Image
        src="/brand/wordmark_inverted.png"
        alt="Selfieface"
        width={compact ? 120 : 160}
        height={compact ? 80 : 107}
        className={
          compact
            ? 'h-8 w-auto object-contain'
            : 'h-10 w-auto object-contain'
        }
        priority
      />
    </span>
  );
}
