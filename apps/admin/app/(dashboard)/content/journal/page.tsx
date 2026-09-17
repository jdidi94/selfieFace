'use client';

import { adminFetch } from '@/lib/api';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { journalArticleUpsertSchema } from '@lumea/validation';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import {
  JournalArticleStatus,
  type JournalArticleDetail,
} from '@lumea/types';
import {
  Badge,
  Button,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumea/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function JournalListPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const router = useRouter();
  const [items, setItems] = useState<JournalArticleDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const data = await adminFetch<JournalArticleDetail[]>('/admin/journal', accessToken);
    setItems(data);
    setLoading(false);
  }, [accessToken, market]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  async function createDraft() {
    if (!accessToken) {
      window.alert('You must be signed in to create an article');
      return;
    }
    const payload = {
      status: JournalArticleStatus.DRAFT,
      translations: [
        {
          locale: 'en' as const,
          title: 'Untitled article',
          excerpt: '',
          body: 'Start writing…',
        },
      ],
    };
    const validated = validateWithSchema(journalArticleUpsertSchema, payload);
    if (!validated.ok) {
      window.alert(validated.message);
      return;
    }
    try {
      const article = await adminFetch<JournalArticleDetail>('/admin/journal', accessToken, {
        method: 'POST',
        body: JSON.stringify(validated.data),
      });
      router.push(`/content/journal/${article.id}`);
    } catch (err) {
      window.alert(submitErrorState(err).message);
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    await adminFetch(`/admin/journal/${id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Journal</h1>
        <Button onClick={() => void createDraft()}>New article</Button>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title (EN)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const enTitle =
                item.translations?.find((t) => t.locale === 'en')?.title ?? item.title;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/content/journal/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {enTitle}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === JournalArticleStatus.PUBLISHED ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.slug}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => void remove(item.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
