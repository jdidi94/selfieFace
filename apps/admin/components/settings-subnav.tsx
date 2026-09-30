'use client';

import { cn } from '@lumea/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/catalog/settings', label: 'General', exact: true },
  { href: '/catalog/settings/shipping', label: 'Shipping', exact: false },
  { href: '/catalog/settings/contact', label: 'Contact & social', exact: false },
  { href: '/catalog/settings/payments', label: 'Payments & secrets', exact: false },
  { href: '/catalog/settings/mail', label: 'Email', exact: false },
] as const;

export function SettingsSubnav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className={cn('flex flex-wrap gap-2 border-b border-border pb-3', className)}
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-surface-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-surface-muted/60 hover:text-foreground',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
