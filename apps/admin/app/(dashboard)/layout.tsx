import { AppShell } from '@/components/app-shell';
import { AuthProvider } from '@/lib/auth-context';
import { MarketProvider } from '@/lib/market-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MarketProvider>
        <AppShell>{children}</AppShell>
      </MarketProvider>
    </AuthProvider>
  );
}
