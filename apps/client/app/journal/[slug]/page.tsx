import { JournalArticleBody } from '@/components/journal-article-body';
import { BreadcrumbJsonLd } from '@/components/breadcrumb-json-ld';
import { ShopProductGrid } from '@/components/shop-product-grid';
import { ProductListJsonLd } from '@/components/product-list-json-ld';
import { fetchApi, mediaUrl } from '@/lib/api';
import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates, seoImages } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import { Locale, type JournalArticleDetail } from '@lumea/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { locale, currency, market } = await getStorefrontWindow();

  try {
    const article = await fetchApi<JournalArticleDetail>(
      `/journal/${slug}?locale=${locale}&currency=${currency}`,
    );
    const path = `/journal/${article.slug}`;
    const url = localizedAbsoluteUrl(locale, path, market);
    const image = mediaUrl(article.coverUrl);
    const images = seoImages(image, article.title);
    return {
      title: article.title,
      description: article.excerpt ?? undefined,
      alternates: seoAlternates(path, locale, market),
      openGraph: {
        title: article.title,
        description: article.excerpt ?? undefined,
        url,
        siteName: 'Selfieface',
        locale,
        type: 'article',
        images,
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: article.title,
        description: article.excerpt ?? undefined,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return { title: 'Journal' };
  }
}

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale, currency, market } = await getStorefrontWindow();
  const t = getMessages(locale);

  let article: JournalArticleDetail;
  try {
    article = await fetchApi<JournalArticleDetail>(
      `/journal/${slug}?locale=${locale}&currency=${currency}`,
    );
  } catch {
    notFound();
  }

  const cover = mediaUrl(article.coverUrl);
  const recommended = article.recommendedProducts ?? [];
  const articleUrl = localizedAbsoluteUrl(locale, `/journal/${article.slug}`, market);

  return (
    <main className="px-6 py-12">
      <BreadcrumbJsonLd
        items={[
          { name: 'Selfieface', url: localizedAbsoluteUrl(locale, '/', market) },
          { name: t.journal, url: localizedAbsoluteUrl(locale, '/journal', market) },
          { name: article.title, url: articleUrl },
        ]}
      />
      <article className="mx-auto max-w-2xl">
        <Link href="/journal" className="text-sm text-muted-foreground hover:underline">
          ← {t.journal}
        </Link>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="mt-6 aspect-[16/9] w-full rounded-lg object-cover"
          />
        )}
        <h1 className="font-display mt-8 text-4xl leading-tight md:text-5xl">{article.title}</h1>
        {article.excerpt && (
          <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>
        )}
        <div className="mt-10">
          <JournalArticleBody
            body={article.body}
            gallery={article.gallery}
            dir={locale === Locale.AR ? 'rtl' : 'ltr'}
          />
        </div>
      </article>

      {recommended.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl">
          <ProductListJsonLd
            products={recommended}
            url={articleUrl}
            name={t.recommended}
            locale={locale}
            market={market}
          />
          <h2 className="font-display text-2xl md:text-3xl">{t.recommended}</h2>
          <div className="mt-8">
            <ShopProductGrid items={recommended} />
          </div>
        </section>
      )}
    </main>
  );
}
