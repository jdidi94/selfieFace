'use client';

import { authFetch, fetchApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { ProductReviewDto, ProductReviewListResponse } from '@lumea/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
  Rating,
  Textarea,
  toast,
} from '@lumea/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Props = {
  productSlug: string;
  labels: {
    title: string;
    empty: string;
    write: string;
    signIn: string;
    pending: string;
    rejected: string;
    submit: string;
    rating: string;
    reviewTitle: string;
    reviewBody: string;
  };
};

export function ProductReviewsSection({ productSlug, labels }: Props) {
  const { user, accessToken, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [data, setData] = useState<ProductReviewListResponse | null>(null);
  const [mine, setMine] = useState<ProductReviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchApi<ProductReviewListResponse>(
        `/products/${productSlug}/reviews?page=1&pageSize=20`,
      );
      setData(list);
      if (accessToken) {
        const own = await authFetch<ProductReviewDto | null>(
          `/products/${productSlug}/reviews/mine`,
          accessToken,
        );
        setMine(own);
        if (own) {
          setRating(own.rating);
          setTitle(own.title ?? '');
          setBody(own.body);
        }
      } else {
        setMine(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productSlug, accessToken]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const saved = await authFetch<ProductReviewDto>(
        `/products/${productSlug}/reviews`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({ rating, title: title.trim() || null, body: body.trim() }),
        },
      );
      setMine(saved);
      toast('Review submitted for moderation.');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save review');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label={t.loadingReviews} className="py-8" />;
  }

  const summary = data?.summary;

  return (
    <section className="mt-16 border-t border-border pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">{labels.title}</h2>
          {summary && summary.reviewCount > 0 && (
            <div className="mt-2">
              <Rating value={summary.averageRating} count={summary.reviewCount} size="md" />
            </div>
          )}
        </div>
      </div>

      {!user && (
        <Card className="mb-8">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6 text-sm">
            <p className="text-muted-foreground">{labels.write}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/account/login">{labels.signIn}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {user && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">{labels.write}</CardTitle>
            {mine?.status === 'PENDING' && (
              <p className="text-sm text-muted-foreground">{labels.pending}</p>
            )}
            {mine?.status === 'REJECTED' && (
              <p className="text-sm text-destructive">{labels.rejected}</p>
            )}
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void submitReview(e)}>
              <div>
                <Label htmlFor="review-rating">{labels.rating}</Label>
                <Input
                  id="review-rating"
                  type="number"
                  min={1}
                  max={5}
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="mt-1 max-w-[6rem]"
                />
              </div>
              <div>
                <Label htmlFor="review-title">{labels.reviewTitle}</Label>
                <Input
                  id="review-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="review-body">{labels.reviewBody}</Label>
                <Textarea
                  id="review-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1 min-h-[120px]"
                  required
                  minLength={10}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {labels.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!data?.items.length ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="space-y-6">
          {data.items.map((review) => (
            <li key={review.id} className="border-b border-border pb-6 last:border-0">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <Rating value={review.rating} size="sm" />
                <span className="text-sm font-medium text-foreground">{review.authorName}</span>
                <time className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString(locale)}
                </time>
              </div>
              {review.title && <p className="font-medium text-foreground">{review.title}</p>}
              <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
