import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Currency, Prisma, ProductStatus } from '@prisma/client';
import type { CartCouponDto, CartDto, CartItemDto, CartLoyaltyDto, CartStockAdjustmentDto } from '@lumea/types';
import { CouponType as SharedCouponType } from '@lumea/types';
import {
  cartAddItemSchema,
  cartApplyCouponSchema,
  cartApplyLoyaltySchema,
  cartCurrencySchema,
  cartUpdateItemSchema,
} from '@lumea/validation';
import { randomBytes } from 'crypto';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { getSellableStock } from '../products/pack-stock.util';
import { CouponsService } from './coupons.service';
import { StoreSettingsService } from './store-settings.service';

const cartInclude = {
  coupon: true,
  items: {
    include: {
      variant: {
        include: {
          prices: true,
          product: {
            include: {
              images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
              translations: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly couponsService: CouponsService,
    private readonly settingsService: StoreSettingsService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  async getOrCreate(opts: {
    cartId?: string | null;
    guestToken?: string | null;
    userId?: string | null;
    currency?: Currency;
  }): Promise<CartDto> {
    const cart = await this.resolveCart(opts);
    return this.mapCart(cart, opts.userId);
  }

  async addItem(
    opts: {
      cartId?: string | null;
      guestToken?: string | null;
      userId?: string | null;
    },
    input: unknown,
  ): Promise<CartDto> {
    const parsed = cartAddItemSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const currency = (parsed.data.currency ?? 'USD') as Currency;
    let cart = await this.resolveCart({ ...opts, currency });

    if (parsed.data.currency && cart.currency !== parsed.data.currency) {
      cart = await this.prisma.cart.update({
        where: { id: cart.id },
        data: { currency: parsed.data.currency as Currency },
        include: cartInclude,
      });
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: parsed.data.variantId },
      include: { product: true, prices: true },
    });
    if (!variant || !variant.isActive || variant.product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('Variant is not available');
    }
    const sellable = await getSellableStock(this.prisma, variant.id);
    if (sellable < parsed.data.quantity) {
      throw new BadRequestException('Not enough stock for this item');
    }

    const existing = cart.items.find((i) => i.variantId === variant.id);
    const nextQty = (existing?.quantity ?? 0) + parsed.data.quantity;
    if (nextQty > sellable) {
      throw new BadRequestException('Not enough stock for this item');
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: variant.id,
          quantity: parsed.data.quantity,
        },
      });
    }

    return this.getById(cart.id, opts.userId);
  }

  async updateItem(
    cartId: string,
    itemId: string,
    input: unknown,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartDto> {
    const parsed = cartUpdateItemSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const cart = await this.assertCartAccess(cartId, opts);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');
    if (parsed.data.quantity > item.variant.stock) {
      throw new BadRequestException('Not enough stock for this item');
    }
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: parsed.data.quantity },
    });
    return this.getById(cartId, opts.userId);
  }

  async removeItem(
    cartId: string,
    itemId: string,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartDto> {
    await this.assertCartAccess(cartId, opts);
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
    return this.getById(cartId, opts.userId);
  }

  async setCurrency(
    cartId: string,
    input: unknown,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartDto> {
    const parsed = cartCurrencySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.assertCartAccess(cartId, opts);
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { currency: parsed.data.currency as Currency },
    });
    return this.getById(cartId, opts.userId);
  }

  async applyCoupon(
    cartId: string,
    input: unknown,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartDto> {
    const parsed = cartApplyCouponSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const cart = await this.assertCartAccess(cartId, opts);
    const coupon = await this.couponsService.findByCode(parsed.data.code, cart.currency);
    if (!coupon) throw new BadRequestException('This coupon code is invalid');

    const mapped = await this.mapCart(cart, opts.userId);
    const customerId = await this.customerIdForUser(opts.userId);
    await this.couponsService.assertApplicable(coupon, {
      subtotal: mapped.subtotal,
      currency: cart.currency,
      customerId,
      lines: mapped.items.map((i) => ({
        productId: i.productId,
        lineTotal: i.lineTotal,
      })),
    });

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponId: coupon.id },
    });
    return this.getById(cartId, opts.userId);
  }

  async removeCoupon(
    cartId: string,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartDto> {
    await this.assertCartAccess(cartId, opts);
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponId: null },
    });
    return this.getById(cartId, opts.userId);
  }

  async applyLoyalty(
    cartId: string,
    input: unknown,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartDto> {
    const parsed = cartApplyLoyaltySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (!opts.userId) throw new UnauthorizedException('Sign in to redeem loyalty points');

    const cart = await this.assertCartAccess(cartId, opts);
    const settings = await this.settingsService.getByCurrency(cart.currency);
    if (!settings.loyaltyEnabled) {
      throw new BadRequestException('Loyalty program is disabled');
    }

    const customerId = await this.customerIdForUser(opts.userId);
    if (!customerId) throw new UnauthorizedException('Customer profile required');

    const mapped = await this.mapCart(cart, opts.userId);
    const couponDiscount = mapped.couponDiscount ?? 0;
    const subtotalAfterCoupon = Math.max(0, mapped.subtotal - couponDiscount);
    const account = await this.loyaltyService.ensureAccount(customerId, settings);

    if (parsed.data.points === 0) {
      await this.prisma.cart.update({
        where: { id: cartId },
        data: { loyaltyPointsToRedeem: 0 },
      });
      return this.getById(cartId, opts.userId);
    }

    const { points } = this.loyaltyService.assertRedeemAllowed(settings, {
      points: parsed.data.points,
      balance: account.balance,
      subtotalAfterCoupon,
    });

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { loyaltyPointsToRedeem: points },
    });
    return this.getById(cartId, opts.userId);
  }

  async removeLoyalty(
    cartId: string,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartDto> {
    await this.assertCartAccess(cartId, opts);
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { loyaltyPointsToRedeem: 0 },
    });
    return this.getById(cartId, opts.userId);
  }

  async mergeGuestIntoCustomer(guestToken: string, userId: string): Promise<CartDto | null> {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) return null;

    const guestCart = await this.prisma.cart.findUnique({
      where: { guestToken },
      include: cartInclude,
    });
    if (!guestCart) return null;
    if (!guestCart.items.length && !guestCart.couponId) return null;

    let customerCart = await this.prisma.cart.findFirst({
      where: { customerId: customer.id },
      include: cartInclude,
    });
    if (!customerCart) {
      customerCart = await this.prisma.cart.update({
        where: { id: guestCart.id },
        data: { customerId: customer.id, guestToken: null },
        include: cartInclude,
      });
      return this.mapCart(customerCart, userId);
    }

    for (const item of guestCart.items) {
      const existing = customerCart.items.find((i) => i.variantId === item.variantId);
      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: Math.min(existing.quantity + item.quantity, item.variant.stock) },
        });
      } else {
        const capped = Math.min(item.quantity, item.variant.stock);
        if (capped > 0) {
          await this.prisma.cartItem.create({
            data: {
              cartId: customerCart.id,
              variantId: item.variantId,
              quantity: capped,
            },
          });
        }
      }
    }
    if (guestCart.couponId && !customerCart.couponId) {
      await this.prisma.cart.update({
        where: { id: customerCart.id },
        data: { couponId: guestCart.couponId },
      });
    }
    await this.prisma.cart.delete({ where: { id: guestCart.id } });
    return this.getById(customerCart.id, userId);
  }

  async getRawCart(cartId: string): Promise<CartRow> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: cartInclude,
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  async clear(cartId: string) {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponId: null },
    });
  }

  private async getById(id: string, userId?: string | null): Promise<CartDto> {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id },
      include: cartInclude,
    });
    return this.mapCart(cart, userId);
  }

  private async reconcileStock(
    cart: CartRow,
  ): Promise<{ cart: CartRow; adjustments: CartStockAdjustmentDto[] }> {
    const adjustments: CartStockAdjustmentDto[] = [];
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    for (const item of cart.items) {
      const stock = item.variant.stock;
      const translation =
        item.variant.product.translations.find((t) => t.locale === 'en') ??
        item.variant.product.translations[0];
      const productName = translation?.name ?? item.variant.product.name;

      if (stock <= 0) {
        adjustments.push({
          itemId: item.id,
          productName,
          previousQuantity: item.quantity,
          quantity: 0,
          removed: true,
        });
        ops.push(this.prisma.cartItem.delete({ where: { id: item.id } }));
        continue;
      }

      if (item.quantity > stock) {
        adjustments.push({
          itemId: item.id,
          productName,
          previousQuantity: item.quantity,
          quantity: stock,
          removed: false,
        });
        ops.push(
          this.prisma.cartItem.update({
            where: { id: item.id },
            data: { quantity: stock },
          }),
        );
      }
    }

    if (!ops.length) return { cart, adjustments };

    await this.prisma.$transaction(ops);
    const refreshed = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });
    return { cart: refreshed, adjustments };
  }

  private async resolveCart(opts: {
    cartId?: string | null;
    guestToken?: string | null;
    userId?: string | null;
    currency?: Currency;
  }): Promise<CartRow> {
    const currency = opts.currency ?? Currency.USD;

    if (opts.userId) {
      const customer = await this.prisma.customer.findUnique({ where: { userId: opts.userId } });
      if (!customer) throw new UnauthorizedException('Customer profile required');

      if (opts.guestToken) {
        await this.mergeGuestIntoCustomer(opts.guestToken, opts.userId);
      }

      const existing = await this.prisma.cart.findFirst({
        where: { customerId: customer.id },
        include: cartInclude,
      });
      if (existing) return existing;

      return this.prisma.cart.create({
        data: { customerId: customer.id, currency },
        include: cartInclude,
      });
    }

    if (opts.cartId) {
      const byId = await this.prisma.cart.findUnique({
        where: { id: opts.cartId },
        include: cartInclude,
      });
      if (byId && !byId.customerId) return byId;
    }

    if (opts.guestToken) {
      const byGuest = await this.prisma.cart.findUnique({
        where: { guestToken: opts.guestToken },
        include: cartInclude,
      });
      if (byGuest) return byGuest;
    }

    const guestToken = opts.guestToken || randomBytes(24).toString('hex');
    return this.prisma.cart.create({
      data: { guestToken, currency },
      include: cartInclude,
    });
  }

  async assertCartAccess(
    cartId: string,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CartRow> {
    const cart = await this.getRawCart(cartId);
    if (opts.userId) {
      const customer = await this.prisma.customer.findUnique({ where: { userId: opts.userId } });
      if (customer && cart.customerId === customer.id) return cart;
    }
    if (opts.guestToken && cart.guestToken === opts.guestToken) return cart;
    throw new UnauthorizedException('Cart access denied');
  }

  private async customerIdForUser(userId?: string | null): Promise<string | null> {
    if (!userId) return null;
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    return customer?.id ?? null;
  }

  private async mapCart(cart: CartRow, userId?: string | null): Promise<CartDto> {
    const reconciled = await this.reconcileStock(cart);
    cart = reconciled.cart;
    const stockAdjustments = reconciled.adjustments;

    const items: CartItemDto[] = cart.items.map((item) => {
      const price =
        item.variant.prices.find((p) => p.currency === cart.currency) ??
        item.variant.prices.find((p) => p.currency === Currency.USD) ??
        item.variant.prices[0];
      const unitPrice = price?.amount ?? 0;
      const translation =
        item.variant.product.translations.find((t) => t.locale === 'en') ??
        item.variant.product.translations[0];
      return {
        id: item.id,
        variantId: item.variantId,
        productId: item.variant.productId,
        productName: translation?.name ?? item.variant.product.name,
        productSlug: item.variant.product.slug,
        variantName: item.variant.name,
        sku: item.variant.sku,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        stock: item.variant.stock,
        imageUrl: item.variant.product.images[0]?.media.url ?? null,
      };
    });

    const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
    let couponDiscount = 0;
    let couponDto: CartCouponDto | null = null;

    if (cart.coupon) {
      try {
        const customerId = await this.customerIdForUser(userId);
        couponDiscount = await this.couponsService.assertApplicable(cart.coupon, {
          subtotal,
          currency: cart.currency,
          customerId,
          lines: items.map((i) => ({
            productId: i.productId,
            lineTotal: i.lineTotal,
          })),
        });
        couponDto = {
          id: cart.coupon.id,
          code: cart.coupon.code,
          type:
            cart.coupon.type === 'PERCENT'
              ? SharedCouponType.PERCENT
              : SharedCouponType.FIXED,
          percentOff: cart.coupon.percentOff,
        };
      } catch {
        // Stale/invalid coupon — clear quietly so the bag still loads
        await this.prisma.cart.update({
          where: { id: cart.id },
          data: { couponId: null },
        });
        couponDiscount = 0;
        couponDto = null;
      }
    }

    const settings = await this.settingsService.getByCurrency(cart.currency);
    let loyaltyDiscount = 0;
    let loyaltyPointsToRedeem = cart.loyaltyPointsToRedeem ?? 0;
    let loyaltyDto: CartLoyaltyDto | null = null;

    if (settings.loyaltyEnabled && userId) {
      const customerId = await this.customerIdForUser(userId);
      if (customerId) {
        const account = await this.loyaltyService.ensureAccount(customerId, settings);
        const subtotalAfterCoupon = Math.max(0, subtotal - couponDiscount);
        const config = this.loyaltyService.toConfig(settings);

        if (loyaltyPointsToRedeem > 0) {
          try {
            const redeemed = this.loyaltyService.assertRedeemAllowed(settings, {
              points: loyaltyPointsToRedeem,
              balance: account.balance,
              subtotalAfterCoupon,
            });
            loyaltyPointsToRedeem = redeemed.points;
            loyaltyDiscount = redeemed.discount;
            if (loyaltyPointsToRedeem !== cart.loyaltyPointsToRedeem) {
              await this.prisma.cart.update({
                where: { id: cart.id },
                data: { loyaltyPointsToRedeem },
              });
            }
          } catch {
            await this.prisma.cart.update({
              where: { id: cart.id },
              data: { loyaltyPointsToRedeem: 0 },
            });
            loyaltyPointsToRedeem = 0;
            loyaltyDiscount = 0;
          }
        }

        loyaltyDto = {
          enabled: true,
          balance: account.balance,
          pointsToRedeem: loyaltyPointsToRedeem,
          discount: loyaltyDiscount,
          pointValueMinor: config.pointValueMinor,
          pointsPerMajorUnit: config.pointsPerMajorUnit,
          minOrderMinor: config.minOrderMinor,
          maxRedeemBps: config.maxRedeemBps,
        };
      }
    } else if (loyaltyPointsToRedeem > 0) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { loyaltyPointsToRedeem: 0 },
      });
      loyaltyPointsToRedeem = 0;
    }

    const discount = couponDiscount + loyaltyDiscount;
    const total = Math.max(0, subtotal - discount);
    const freeShippingThreshold = this.settingsService.freeShippingThreshold(
      settings,
      cart.currency,
    );
    const amountUntilFreeShipping =
      freeShippingThreshold > 0 ? Math.max(0, freeShippingThreshold - total) : 0;

    return {
      id: cart.id,
      currency: cart.currency as CartDto['currency'],
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal,
      discount,
      couponDiscount,
      total,
      coupon: couponDto,
      loyalty: loyaltyDto,
      items,
      freeShippingThreshold,
      amountUntilFreeShipping,
      ...(stockAdjustments.length ? { stockAdjustments } : {}),
    };
  }
}
