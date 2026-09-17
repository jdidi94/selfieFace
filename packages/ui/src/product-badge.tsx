import { Badge, type BadgeProps } from './badge';
import { cn } from './lib/cn';

export type ProductBadgeProps = BadgeProps & {
  label: string;
};

export function ProductBadge({ label, className, variant = 'secondary', ...props }: ProductBadgeProps) {
  return (
    <Badge variant={variant} className={cn(className)} {...props}>
      {label}
    </Badge>
  );
}
