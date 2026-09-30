'use client';

import {
  ConfirmTypedDialog,
  typedConfirmToken,
} from '@/components/confirm-typed-dialog';
import { adminFetch } from '@/lib/api';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { journalArticleUpsertSchema } from '@lumea/validation';
import { useAuth } from '@/lib/auth-context';
import { useAdminMarket } from '@/lib/market-context';
import {
  JournalArticleStatus,
  type AdminJournalListResponse,
  type JournalArticleDetail,
} from '@lumea/types';
import {
  Badge,
  Button,
  LoadingState,
  Pagination,
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

const PAGE_SIZE = 25;

export default function JournalListPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const { market } = useAdminMarket();
  const router = useRouter();
  const [data, setData] = useState<AdminJournalListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<JournalArticleDetail | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const result = await adminFetch<AdminJournalListResponse>(
      `/admin/journal?${params.toString()}`,
      accessToken,
    );
    setData(result);
    setLoading(false);
  }, [accessToken, market, page]);

  useEffect(() => {
    if (!authLoading && accessToken) void load();
  }, [accessToken, authLoading, load]);

  useEffect(() => {
    setPage(1);
  }, [market]);

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

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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
            {!items.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No articles yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
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
                      <Badge
                        variant={
                          item.status === JournalArticleStatus.PUBLISHED ? 'default' : 'secondary'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.slug}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPendingDelete(item)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * data.pageSize + (items.length ? 1 : 0)}–
            {(page - 1) * data.pageSize + items.length} of {data.total}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <ConfirmTypedDialog
        open={!!pendingDelete}
        title="Delete article"
        description={
          pendingDelete
            ? `This permanently deletes “${
                pendingDelete.translations?.find((t) => t.locale === 'en')?.title ??
                pendingDelete.title
              }”.`
            : ''
        }
        confirmLabel={typedConfirmToken(
          pendingDelete?.translations?.find((t) => t.locale === 'en')?.title ??
            pendingDelete?.title,
          'DELETE',
        )}
        confirmValue={typedConfirmToken(
          pendingDelete?.translations?.find((t) => t.locale === 'en')?.title ??
            pendingDelete?.title,
          'DELETE',
        )}
        confirmButtonLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
