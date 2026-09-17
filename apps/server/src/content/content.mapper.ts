import type {
  MarketCode,
  JournalArticleDetail,
  JournalArticleImageDto,
  JournalArticleListItem,
  JournalArticleTranslationDto,
  Locale,
  ProductListItem,
  PromoBannerDto,
  PromoBannerTranslationDto,
} from '@lumea/types';
import { Locale as SharedLocale } from '@lumea/types';
import type {
  JournalArticle,
  JournalArticleImage,
  JournalArticleTranslation,
  Media,
  PromoBanner,
  PromoBannerTranslation,
} from '@prisma/client';

type GalleryRow = JournalArticleImage & { media: Media };

type ArticleWithRelations = JournalArticle & {
  translations: JournalArticleTranslation[];
  coverMedia?: Media | null;
  gallery?: GalleryRow[];
  market?: { code: string } | null;
};

type BannerWithRelations = PromoBanner & {
  translations: PromoBannerTranslation[];
  imageMedia?: Media | null;
  market?: { code: string } | null;
};

function pickTranslation<T extends { locale: string }>(
  translations: T[] | undefined,
  locale: SharedLocale,
): T | undefined {
  if (!translations?.length) return undefined;
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === SharedLocale.EN) ??
    translations[0]
  );
}

export function mapJournalGallery(gallery: GalleryRow[] | undefined): JournalArticleImageDto[] {
  return [...(gallery ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => ({
      id: img.id,
      mediaId: img.mediaId,
      url: img.media.url,
      alt: img.alt,
      sortOrder: img.sortOrder,
    }));
}

export function mapJournalListItem(
  row: ArticleWithRelations,
  locale: SharedLocale = SharedLocale.EN,
): JournalArticleListItem {
  const t = pickTranslation(row.translations, locale);
  return {
    id: row.id,
    slug: row.slug,
    status: row.status as JournalArticleListItem['status'],
    title: t?.title ?? '',
    excerpt: t?.excerpt ?? null,
    coverUrl: row.coverMedia?.url ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    locale,
    marketCode: row.market?.code ? (row.market.code as MarketCode) : undefined,
  };
}

export function mapJournalDetail(
  row: ArticleWithRelations,
  locale: SharedLocale = SharedLocale.EN,
  includeAll = false,
  recommendedProducts?: ProductListItem[],
): JournalArticleDetail {
  const t = pickTranslation(row.translations, locale);
  const translations: JournalArticleTranslationDto[] | undefined = includeAll
    ? row.translations.map((tr) => ({
        locale: tr.locale as Locale,
        title: tr.title,
        excerpt: tr.excerpt,
        body: tr.body,
      }))
    : undefined;

  const gallery = mapJournalGallery(row.gallery);

  return {
    ...mapJournalListItem(row, locale),
    body: t?.body ?? '',
    coverMediaId: includeAll ? row.coverMediaId : undefined,
    gallery,
    galleryMediaIds: includeAll ? gallery.map((g) => g.mediaId) : undefined,
    recommendedProducts,
    recommendedProductIds: includeAll
      ? recommendedProducts?.map((p) => p.id)
      : undefined,
    translations,
  };
}

export function mapPromoBanner(
  row: BannerWithRelations,
  locale: SharedLocale = SharedLocale.EN,
  includeAll = false,
): PromoBannerDto {
  const t = pickTranslation(row.translations, locale);
  const translations: PromoBannerTranslationDto[] | undefined = includeAll
    ? row.translations.map((tr) => ({
        locale: tr.locale as Locale,
        title: tr.title,
        subtitle: tr.subtitle,
        ctaLabel: tr.ctaLabel,
      }))
    : undefined;

  return {
    id: row.id,
    placement: row.placement as PromoBannerDto['placement'],
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    marketCode: row.market?.code ? (row.market.code as MarketCode) : undefined,
    href: row.href,
    imageMediaId: includeAll ? row.imageMediaId : undefined,
    imageUrl: row.imageMedia?.url ?? null,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    title: t?.title ?? '',
    subtitle: t?.subtitle ?? null,
    ctaLabel: t?.ctaLabel ?? null,
    locale,
    translations,
  };
}

export function isBannerScheduleActive(row: PromoBanner, at = new Date()): boolean {
  if (!row.isActive) return false;
  if (row.startsAt && row.startsAt > at) return false;
  if (row.endsAt && row.endsAt < at) return false;
  return true;
}
