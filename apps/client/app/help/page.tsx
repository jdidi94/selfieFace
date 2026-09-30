import { fetchApi } from '@/lib/api';
import { LocaleLink } from '@/components/locale-link';
import { getMessages } from '@/lib/messages';
import { localizedAbsoluteUrl, seoAlternates } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import type { FaqListResponse } from '@lumea/types';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { locale, market } = await getStorefrontWindow();
  const t = getMessages(locale);
  const path = '/help';
  return {
    title: t.helpTitle,
    description: t.helpSubtitle,
    alternates: seoAlternates(path, locale, market),
    openGraph: {
      title: t.helpTitle,
      description: t.helpSubtitle,
      url: localizedAbsoluteUrl(locale, path, market),
      siteName: 'Selfieface',
      locale,
      type: 'website',
    },
  };
}

export default async function HelpPage() {
  const { locale, currency, market } = await getStorefrontWindow();
  const t = getMessages(locale);

  const data = await fetchApi<FaqListResponse>(
    `/content/faq?locale=${locale}&currency=${currency}&market=${market}`,
  ).catch(() => ({ items: [], locale }));

  const byCategory = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const key = item.category?.trim() || '';
    const list = byCategory.get(key) ?? [];
    list.push(item);
    byCategory.set(key, list);
  }

  const groups = [...byCategory.entries()].sort(([a], [b]) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  return (
    <main className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display mb-2 text-4xl md:text-5xl">{t.helpTitle}</h1>
        <p className="mb-10 text-muted-foreground">{t.helpSubtitle}</p>

        {data.items.length === 0 ? (
          <p className="text-muted-foreground">{t.helpEmpty}</p>
        ) : (
          <div className="space-y-10">
            {groups.map(([category, items]) => (
              <section key={category || '_uncategorized'}>
                {category ? (
                  <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {category}
                  </h2>
                ) : null}
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id} className="py-5 first:pt-0">
                      <h3 className="font-medium text-foreground">{item.question}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {item.answer}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="mt-12 border-t border-border pt-6 text-sm">
          <LocaleLink href="/contact" className="underline underline-offset-2 hover:text-foreground">
            {t.helpContactCta}
          </LocaleLink>
        </p>
      </div>
    </main>
  );
}
