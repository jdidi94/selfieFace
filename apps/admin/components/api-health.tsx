'use client';

import { apiUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@lumea/ui';
import type { HealthStatus } from '@lumea/types';
import { useEffect, useState } from 'react';

export function ApiHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${apiUrl}/health`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthStatus>;
      })
      .then(setHealth)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to reach API');
      });
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">API health</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {error && <p className="text-destructive">Unreachable: {error}</p>}
        {!error && !health && <p>Checking…</p>}
        {health && (
          <p>
            status <span className="text-foreground">{health.status}</span> · database{' '}
            <span className="text-foreground">{health.database}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
