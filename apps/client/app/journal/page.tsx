import { fetchApi, mediaUrl } from '@/lib/api';
import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import type { JournalListResponse } from '@lumea/types';
import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { locale, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const path = '/journal';
  const url = localizedAbsoluteUrl(locale, path, market);
  return {
    title: t.journalTitle,
    description: t.journalSubtitle,
    alternates: seoAlternates(path, locale, market),
    openGraph: {
      title: t.journalTitle,
      description: t.journalSubtitle,
      url,
      siteName: 'Selfieface',
      locale,
      type: 'website',
    },
  };
}

export default async function JournalPage() {
  const { locale, currency } = await getStorefrontWindow();
  const t = getMessages(locale);

  const data = await fetchApi<JournalListResponse>(
    `/journal?locale=${locale}&currency=${currency}&pageSize=24`,
  ).catch(() => ({ items: [], total: 0, page: 1, pageSize: 24, locale }));

  return (
    <main className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display mb-2 text-4xl md:text-5xl">{t.journalTitle}</h1>
        <p className="mb-10 text-muted-foreground">{t.journalSubtitle}</p>

        {data.items.length === 0 ? (
          <p className="text-muted-foreground">{t.journalEmpty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.items.map((article) => {
              const cover = mediaUrl(article.coverUrl);
              return (
                <li key={article.id} className="py-8 first:pt-0">
                  <Link href={`/journal/${article.slug}`} className="group block">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="mb-4 aspect-[16/9] w-full rounded-lg object-cover"
                      />
                    )}
                    <h2 className="font-display text-2xl group-hover:underline">{article.title}</h2>
                    {article.excerpt && (
                      <p className="mt-2 text-muted-foreground">{article.excerpt}</p>
                    )}
                    {article.publishedAt && (
                      <p className="mt-3 text-xs tracking-wide text-muted-foreground uppercase">
                        {new Date(article.publishedAt).toLocaleDateString(locale)}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
