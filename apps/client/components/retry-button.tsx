'use client';

import { Button } from '@lumea/ui';
import { useRouter } from 'next/navigation';

export function RetryButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button type="button" onClick={() => router.refresh()}>
      {label}
    </Button>
  );
}
