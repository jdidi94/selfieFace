'use client';

import {
  ConfirmTypedDialog,
  typedConfirmToken,
} from '@/components/confirm-typed-dialog';
import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { adminFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { faqItemUpsertSchema } from '@lumea/validation';
import { Locale, type AdminFaqListResponse, type FaqItemDto } from '@lumea/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  LoadingState,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@lumea/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

type FaqForm = {
  category: string;
  sortOrder: number;
  published: boolean;
  questions: Record<Locale, string>;
  answers: Record<Locale, string>;
};

function emptyForm(): FaqForm {
  return {
    category: '',
    sortOrder: 0,
    published: false,
    questions: { [Locale.EN]: '', [Locale.AR]: '', [Locale.FR]: '' },
    answers: { [Locale.EN]: '', [Locale.AR]: '', [Locale.FR]: '' },
  };
}

function formFromItem(item: FaqItemDto): FaqForm {
  const form = emptyForm();
  form.category = item.category ?? '';
  form.sortOrder = item.sortOrder;
  form.published = item.published;
  for (const locale of [Locale.EN, Locale.AR, Locale.FR]) {
    const tr = item.translations?.find((t) => t.locale === locale);
    if (tr) {
      form.questions[locale] = tr.question;
      form.answers[locale] = tr.answer;
    } else if (locale === Locale.EN) {
      form.questions[locale] = item.question;
      form.answers[locale] = item.answer;
    }
  }
  return form;
}

function payloadFromForm(form: FaqForm) {
  const translations = ([Locale.EN, Locale.AR, Locale.FR] as const)
    .filter((locale) => form.questions[locale].trim() && form.answers[locale].trim())
    .map((locale) => ({
      locale,
      question: form.questions[locale].trim(),
      answer: form.answers[locale].trim(),
    }));

  return {
    category: form.category.trim() || null,
    sortOrder: form.sortOrder,
    published: form.published,
    translations,
  };
}

export default function FaqAdminPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [items, setItems] = useState<FaqItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<FaqItemDto | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    if (!loadedOnce.current) setLoading(true);
    try {
      const data = await adminFetch<AdminFaqListResponse>('/admin/faq', accessToken, {
        skipCache: true,
      });
      setItems(data.items);
      loadedOnce.current = true;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void load();
  }, [authLoading, accessToken, load]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(item: FaqItemDto) {
    setEditId(item.id);
    setForm(formFromItem(item));
    setError(null);
    setFieldErrors({});
    setOpen(true);
  }

  async function save() {
    if (!accessToken) {
      setError('You must be signed in to save');
      return;
    }
    setError(null);
    setFieldErrors({});
    const body = payloadFromForm(form);
    const validated = validateWithSchema(faqItemUpsertSchema, body);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }
    try {
      if (editId) {
        await adminFetch(`/admin/faq/${editId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(validated.data),
        });
      } else {
        await adminFetch('/admin/faq', accessToken, {
          method: 'POST',
          body: JSON.stringify(validated.data),
        });
      }
      setOpen(false);
      await load();
    } catch (err) {
      const state = submitErrorState(err);
      setError(state.message);
      setFieldErrors(state.fieldErrors);
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    await adminFetch(`/admin/faq/${id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  if (authLoading || loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">FAQ</h1>
          <p className="text-sm text-muted-foreground">
            Help articles for the current market (en / fr / ar).
          </p>
        </div>
        <Button onClick={openCreate}>New FAQ</Button>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question (EN)</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead>Published</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-md truncate">{item.question}</TableCell>
                <TableCell>{item.category || '—'}</TableCell>
                <TableCell>{item.sortOrder}</TableCell>
                <TableCell>
                  <Badge variant={item.published ? 'secondary' : 'outline'}>
                    {item.published ? 'Yes' : 'Draft'}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setPendingDelete(item)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No FAQ items yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ConfirmTypedDialog
        open={!!pendingDelete}
        title="Delete FAQ"
        description={
          pendingDelete
            ? `This permanently deletes “${pendingDelete.question.slice(0, 80)}”.`
            : ''
        }
        confirmLabel={typedConfirmToken(pendingDelete?.question?.slice(0, 40), 'DELETE')}
        confirmValue={typedConfirmToken(pendingDelete?.question?.slice(0, 40), 'DELETE')}
        confirmButtonLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setError(null);
            setFieldErrors({});
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit FAQ' : 'New FAQ'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormErrorBanner message={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Shipping, Returns…"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.published}
                onCheckedChange={(published) => setForm((f) => ({ ...f, published }))}
              />
              <Label>Published</Label>
            </div>
            <Tabs defaultValue={Locale.EN}>
              <TabsList>
                <TabsTrigger value={Locale.EN}>EN</TabsTrigger>
                <TabsTrigger value={Locale.FR}>FR</TabsTrigger>
                <TabsTrigger value={Locale.AR}>AR</TabsTrigger>
              </TabsList>
              {([Locale.EN, Locale.FR, Locale.AR] as const).map((locale) => (
                <TabsContent key={locale} value={locale} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Question {locale === Locale.EN ? '(required)' : ''}</Label>
                    <Input
                      value={form.questions[locale]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          questions: { ...f.questions, [locale]: e.target.value },
                        }))
                      }
                    />
                    <FieldError fieldErrors={fieldErrors} field="translations" />
                  </div>
                  <div className="space-y-2">
                    <Label>Answer</Label>
                    <Textarea
                      rows={5}
                      value={form.answers[locale]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          answers: { ...f.answers, [locale]: e.target.value },
                        }))
                      }
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void save()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
