import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Currency, ProductStatus } from '@prisma/client';
import type { WishlistItemDto } from '@lumea/types';
import { Currency as SharedCurrency } from '@lumea/types';
import { wishlistAddSchema } from '@lumea/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, currency: Currency = Currency.USD): Promise<WishlistItemDto[]> {
    const customer = await this.requireCustomer(userId);
    const items = await this.prisma.wishlistItem.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
            translations: true,
            variants: { include: { prices: true } },
          },
        },
      },
    });

    return items.map((item) => this.mapItem(item, currency));
  }

  async add(userId: string, input: unknown, currency: Currency = Currency.USD): Promise<WishlistItemDto> {
    const parsed = wishlistAddSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const customer = await this.requireCustomer(userId);
    const product = await this.prisma.product.findUnique({
      where: { id: parsed.data.productId },
      include: {
        images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
        translations: true,
        variants: { include: { prices: true } },
      },
    });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('Product is not available');
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        customerId_productId: {
          customerId: customer.id,
          productId: product.id,
        },
      },
      include: {
        product: {
          include: {
            images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
            translations: true,
            variants: { include: { prices: true } },
          },
        },
      },
    });
    if (existing) return this.mapItem(existing, currency);

    const created = await this.prisma.wishlistItem.create({
      data: {
        customerId: customer.id,
        productId: product.id,
      },
      include: {
        product: {
          include: {
            images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
            translations: true,
            variants: { include: { prices: true } },
          },
        },
      },
    });
    return this.mapItem(created, currency);
  }

  async remove(userId: string, productId: string): Promise<void> {
    const customer = await this.requireCustomer(userId);
    const result = await this.prisma.wishlistItem.deleteMany({
      where: { customerId: customer.id, productId },
    });
    if (result.count === 0) throw new NotFoundException('Wishlist item not found');
  }

  async productIds(userId: string): Promise<string[]> {
    const customer = await this.requireCustomer(userId);
    const items = await this.prisma.wishlistItem.findMany({
      where: { customerId: customer.id },
      select: { productId: true },
    });
    return items.map((i) => i.productId);
  }

  private async requireCustomer(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new UnauthorizedException('Customer profile required');
    return customer;
  }

  private mapItem(
    item: {
      id: string;
      productId: string;
      createdAt: Date;
      product: {
        name: string;
        slug: string;
        status: ProductStatus;
        translations: { locale: string; name: string }[];
        images: { media: { url: string } }[];
        variants: {
          isActive: boolean;
          stock: number;
          prices: { currency: Currency; amount: number; compareAtAmount: number | null }[];
        }[];
      };
    },
    currency: Currency,
  ): WishlistItemDto {
    const translation =
      item.product.translations.find((t) => t.locale === 'en') ?? item.product.translations[0];
    const activeVariants = item.product.variants.filter((v) => v.isActive);
    const amounts = activeVariants
      .map((v) => {
        const price =
          v.prices.find((p) => p.currency === currency) ??
          v.prices.find((p) => p.currency === Currency.USD) ??
          v.prices[0];
        return price;
      })
      .filter(Boolean);
    const priceFrom = amounts.length ? Math.min(...amounts.map((p) => p!.amount)) : 0;
    const compareAts = amounts
      .map((p) => p!.compareAtAmount)
      .filter((n): n is number => n != null);
    const compareAtFrom = compareAts.length ? Math.min(...compareAts) : null;
    const inStock = activeVariants.some((v) => v.stock > 0);

    return {
      id: item.id,
      productId: item.productId,
      productName: translation?.name ?? item.product.name,
      productSlug: item.product.slug,
      imageUrl: item.product.images[0]?.media.url ?? null,
      priceFrom,
      compareAtFrom,
      currency:
        currency === Currency.TND
          ? SharedCurrency.TND
          : currency === Currency.AED
            ? SharedCurrency.AED
            : SharedCurrency.USD,
      inStock,
      createdAt: item.createdAt.toISOString(),
    };
  }
}
