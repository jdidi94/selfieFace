import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReviewStatus as PrismaReviewStatus } from '@prisma/client';
import {
  ReviewStatus as SharedReviewStatus,
  type AdminReviewListResponse,
  type ProductRatingSummary,
  type ProductReviewDto,
  type ProductReviewListResponse,
} from '@lumea/types';
import {
  adminReviewListQuerySchema,
  reviewListQuerySchema,
  reviewModerationSchema,
  reviewUpsertSchema,
} from '@lumea/validation';
import { PrismaService } from '../prisma/prisma.service';

function authorDisplayName(firstName?: string | null, lastName?: string | null): string {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return 'Selfieface customer';
}

function mapPublicReview(row: {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: PrismaReviewStatus;
  createdAt: Date;
  customer: {
    phone?: string | null;
    user: { firstName: string | null; lastName: string | null } | null;
  };
}): ProductReviewDto {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status as SharedReviewStatus,
    createdAt: row.createdAt.toISOString(),
    authorName: authorDisplayName(
      row.customer.user?.firstName,
      row.customer.user?.lastName,
    ),
  };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async ratingSummariesForProducts(
    productIds: string[],
  ): Promise<Map<string, ProductRatingSummary>> {
    const map = new Map<string, ProductRatingSummary>();
    if (!productIds.length) return map;

    const groups = await this.prisma.review.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        status: PrismaReviewStatus.APPROVED,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    for (const row of groups) {
      map.set(row.productId, {
        averageRating: row._avg.rating != null ? Math.round(row._avg.rating * 10) / 10 : 0,
        reviewCount: row._count.rating,
      });
    }
    return map;
  }

  async listForProduct(slug: string, query: unknown): Promise<ProductReviewListResponse> {
    const parsed = reviewListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const where = {
      productId: product.id,
      status: PrismaReviewStatus.APPROVED,
    };

    const [total, rows, agg] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          customer: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parsed.data.page - 1) * parsed.data.pageSize,
        take: parsed.data.pageSize,
      }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      items: rows.map(mapPublicReview),
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      summary: {
        averageRating:
          agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : 0,
        reviewCount: agg._count.rating,
      },
    };
  }

  async getMineForProduct(userId: string, slug: string): Promise<ProductReviewDto | null> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new ForbiddenException('Customer profile required');

    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const row = await this.prisma.review.findUnique({
      where: {
        productId_customerId: { productId: product.id, customerId: customer.id },
      },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    return row ? mapPublicReview(row) : null;
  }

  async upsertForProduct(userId: string, slug: string, input: unknown): Promise<ProductReviewDto> {
    const parsed = reviewUpsertSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new ForbiddenException('Customer profile required');

    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const row = await this.prisma.review.upsert({
      where: {
        productId_customerId: { productId: product.id, customerId: customer.id },
      },
      create: {
        productId: product.id,
        customerId: customer.id,
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        body: parsed.data.body,
        status: PrismaReviewStatus.PENDING,
      },
      update: {
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        body: parsed.data.body,
        status: PrismaReviewStatus.PENDING,
      },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    return mapPublicReview(row);
  }

  async listAdmin(query: unknown): Promise<AdminReviewListResponse> {
    const parsed = adminReviewListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const where: Prisma.ReviewWhereInput = {};

    if (parsed.data.status) where.status = parsed.data.status as PrismaReviewStatus;
    if (parsed.data.q?.trim()) {
      const q = parsed.data.q.trim();
      where.OR = [
        { body: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { user: { email: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          customer: {
            include: {
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parsed.data.page - 1) * parsed.data.pageSize,
        take: parsed.data.pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        productId: row.product.id,
        productName: row.product.name,
        productSlug: row.product.slug,
        customerEmail:
          row.customer.user?.email ??
          (row.customer.phone ? `guest:${row.customer.phone}` : 'guest'),
        rating: row.rating,
        title: row.title,
        body: row.body,
        status: row.status as SharedReviewStatus,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    };
  }

  async moderateAdmin(reviewId: string, input: unknown) {
    const parsed = reviewModerationSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new NotFoundException('Review not found');

    const row = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: parsed.data.status as PrismaReviewStatus },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { include: { user: { select: { email: true } } } },
      },
    });

    return {
      id: row.id,
      productId: row.product.id,
      productName: row.product.name,
      productSlug: row.product.slug,
      customerEmail:
        row.customer.user?.email ??
        (row.customer.phone ? `guest:${row.customer.phone}` : 'guest'),
      rating: row.rating,
      title: row.title,
      body: row.body,
      status: row.status as SharedReviewStatus,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
