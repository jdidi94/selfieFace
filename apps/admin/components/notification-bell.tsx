'use client';

import { adminFetch, publicApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

function socketOrigin() {
  try { const url = new URL(publicApiUrl); url.pathname = ''; url.search = ''; url.hash = ''; return url.toString().replace(/\/$/, ''); }
  catch { return 'http://localhost:4000'; }
}

export function NotificationBell() {
  const { accessToken } = useAuth();
  const { market } = useAdminMarket();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    const refresh = () => { void adminFetch<{ unreadCount: number }>('/admin/notifications', accessToken, { skipCache: true }).then((data) => { if (alive) setCount(data.unreadCount); }).catch(() => {}); };
    refresh();
    window.addEventListener('admin-notification-changed', refresh);
    const socket = io(socketOrigin(), { auth: { token: accessToken, market }, reconnectionAttempts: 5 });
    socket.on('admin:notification', () => {
      setCount((value) => value + 1);
      window.dispatchEvent(new Event('admin-notification-received'));
    });
    return () => { alive = false; window.removeEventListener('admin-notification-changed', refresh); socket.disconnect(); };
  }, [accessToken, market]);
  return <Link href="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} className="relative rounded-md p-2 text-foreground hover:bg-surface-muted">
    <Bell className="h-5 w-5" />
    {count ? <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] text-white">{count > 99 ? '99+' : count}</span> : null}
  </Link>;
}
