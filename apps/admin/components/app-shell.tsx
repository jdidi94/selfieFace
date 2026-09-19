'use client';

import { useAuth } from '@/lib/auth-context';
import { marketLabel, useAdminMarket } from '@/lib/market-context';
import { AdminBrandMark } from '@/components/admin-brand-mark';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@lumea/ui';
import { MarketCode } from '@lumea/types';
import {
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  LayoutGrid,
  Settings,
  ShoppingCart,
  TicketPercent,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

const navSections = [
  {
    label: 'Overview',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/catalog/products', label: 'Products', icon: Package },
      { href: '/catalog/categories', label: 'Categories', icon: Package },
      { href: '/catalog/brands', label: 'Brands', icon: Package },
      { href: '/catalog/inventory', label: 'Inventory', icon: Package },
      { href: '/catalog/warehouses', label: 'Warehouses', icon: Package },
      { href: '/catalog/stock-notify', label: 'Stock alerts', icon: Package },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/reviews', label: 'Reviews', icon: MessageSquare },
    ],
  },
  {
    label: 'Content',
    items: [{ href: '/content/journal', label: 'Journal', icon: FileText }],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/content/banners', label: 'Banners', icon: Megaphone },
      { href: '/marketing/promotions', label: 'Campaigns', icon: Megaphone },
      { href: '/marketing/coupons', label: 'Coupons', icon: TicketPercent },
      { href: '/marketing/merchandising', label: 'Homepage rails', icon: LayoutGrid },
      { href: '/marketing/mail', label: 'Marketing mail', icon: Mail },
      { href: '/marketing/email-logs', label: 'Email logs', icon: Mail },
    ],
  },
  {
    label: 'Insights',
    items: [{ href: '/analytics', label: 'Analytics', icon: BarChart3 }],
  },
  {
    label: 'System',
    items: [
      { href: '/help', label: 'Admin guide', icon: BookOpen },
      { href: '/catalog/settings', label: 'Settings', icon: Settings },
      { href: '/catalog/markets', label: 'Markets', icon: Settings },
    ],
  },
];

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { market, setMarket, markets } = useAdminMarket();
  const router = useRouter();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="border-b border-border px-5 py-5">
          <AdminBrandMark />
          <Badge variant="secondary" className="mt-2">
            Admin
          </Badge>
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Working market
            </p>
            <Select
              value={market}
              onValueChange={(value) => {
                const next = value as MarketCode;
                if (next === market) return;
                setMarket(next);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select market" />
              </SelectTrigger>
              <SelectContent>
                {(markets.length
                  ? markets.map((m) => m.code)
                  : [MarketCode.AE, MarketCode.TN, MarketCode.OTHER]
                ).map((code) => (
                  <SelectItem key={code} value={code}>
                    {marketLabel(code)}
                    {markets.find((m) => m.code === code)?.enabled === false
                      ? ' · disabled'
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-surface-muted hover:text-foreground"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-70" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
          <p className="text-sm font-medium text-foreground">
            Dashboard · {marketLabel(market)}
          </p>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            )}
            <Avatar>
              <AvatarFallback>{user ? initials(user.email) : 'LA'}</AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void logout().then(() => router.push('/login'));
              }}
            >
              Sign out
            </Button>
          </div>
        </header>
        {/* Remount page tree on market change so lists/forms refetch for the new window. */}
        <main key={market} className="flex-1 bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShellMobileBar() {
  return (
    <div className="border-b border-border bg-surface px-4 py-3 md:hidden">
      <AdminBrandMark compact />
      <Separator className="mt-3" />
    </div>
  );
}
