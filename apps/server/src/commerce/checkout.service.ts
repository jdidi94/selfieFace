import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Currency,
  InventoryReason,
  Locale,
  OrderStatus,
  OrderTimelineActorType,
  PaymentStatus,
  ProductStatus,
  ShippingZone,
} from '@prisma/client';
import type { CheckoutTotalsDto, OrderDto } from '@lumea/types';
import { PaymentProvider } from '@lumea/types';
import {
  checkoutCreateSchema,
  confirmPaymentSchema,
  shippingQuoteSchema,
} from '@lumea/validation';
import { randomBytes } from 'crypto';
import Stripe from 'stripe';
import { AddressesService } from '../customers/addresses.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MarketsService } from '../markets/markets.service';
import { marketCodeFromCurrencyValue } from '../markets/market.util';
import { PrismaService } from '../prisma/prisma.service';
import { OrderMailHelper } from '../mail/order-mail.helper';
import { SesMailService } from '../mail/ses-mail.service';
import { crossedLowStockThreshold } from '../inventory/low-stock.util';
import { deductSellableStock } from '../products/pack-stock.util';
import { CartService } from './cart.service';
import { CouponsService } from './coupons.service';
import { KonnectService } from './konnect.service';
import { OrdersService } from './orders.service';
import { StoreSettingsService } from './store-settings.service';

function normalizePhone(phone: string): string {
  return phone.replace(/[\s()-]/g, '').trim();
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? '';
  return trimmed.includes('@') ? trimmed : null;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly couponsService: CouponsService,
    private readonly settingsService: StoreSettingsService,
    private readonly ordersService: OrdersService,
    private readonly konnectService: KonnectService,
    private readonly orderMail: OrderMailHelper,
    private readonly addressesService: AddressesService,
    private readonly mail: SesMailService,
    private readonly loyaltyService: LoyaltyService,
    private readonly marketsService: MarketsService,
  ) {}

  private stripeClient(secret: string | null): Stripe | null {
    if (!secret) return null;
    return new Stripe(secret);
  }

  async quoteShipping(
    cartId: string,
    input: unknown,
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<CheckoutTotalsDto> {
    const parsed = shippingQuoteSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const currency = (parsed.data.currency ?? 'USD') as Currency;
    const mapped = await this.cartService.getOrCreate({
      cartId: cartId || undefined,
      guestToken: opts.guestToken,
      userId: opts.userId,
      currency,
    });
    const settings = await this.settingsService.getByCurrency(currency);
    const methods = await this.settingsService.listMethodsByCurrency(true, currency);
    return this.settingsService.buildTotals({
      settings,
      currency,
      country: parsed.data.country,
      subtotal: mapped.subtotal,
      discount: mapped.discount,
      methods,
      shippingMethodId: parsed.data.shippingMethodId,
      coupon: mapped.coupon ?? null,
    });
  }

  async createCheckout(
    input: unknown,
    opts: {
      userId?: string | null;
      guestToken?: string | null;
      idempotencyKey?: string | null;
    },
  ): Promise<OrderDto> {
    const parsed = checkoutCreateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const isGuest = !opts.userId;
    const idempotencyKey =
      (opts.idempotencyKey?.trim() || parsed.data.idempotencyKey?.trim() || null) ?? null;

    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });
      if (existing) {
        return this.replayIdempotentCheckout(existing, {
          userId: opts.userId,
          guestToken: opts.guestToken,
        });
      }
    }

    let shippingAddress = parsed.data.shippingAddress ?? null;
    if (parsed.data.addressId) {
      if (!opts.userId) {
        throw new BadRequestException('addressId requires a signed-in customer');
      }
      const customer = await this.prisma.customer.findUnique({
        where: { userId: opts.userId },
      });
      if (!customer) throw new UnauthorizedException('Customer profile required');
      const saved = await this.prisma.address.findFirst({
        where: { id: parsed.data.addressId, customerId: customer.id },
      });
      if (!saved) throw new NotFoundException('Saved address not found');
      shippingAddress = {
        fullName: saved.fullName,
        line1: saved.line1,
        line2: saved.line2,
        city: saved.city,
        region: saved.region,
        postalCode: saved.postalCode,
        country: saved.country,
        phone: saved.phone,
      };
    }
    if (!shippingAddress) {
      throw new BadRequestException('shippingAddress or addressId is required');
    }

    const contactPhone = normalizePhone(
      parsed.data.phone ?? shippingAddress.phone ?? '',
    );
    const guestEmail = normalizeEmail(parsed.data.email);

    if (isGuest && contactPhone.length < 6) {
      throw new BadRequestException('Phone number is required for guest checkout');
    }

    let customerId: string;
    let guestAccessToken: string | null = null;

    if (opts.userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId: opts.userId },
      });
      if (!customer) throw new UnauthorizedException('Customer profile required');
      customerId = customer.id;
    } else {
      const guest = await this.findOrCreateGuestCustomer(contactPhone, guestEmail);
      customerId = guest.id;
      guestAccessToken = randomBytes(24).toString('hex');
    }

    const cart = await this.cartService.getRawCart(parsed.data.cartId);
    await this.cartService.assertCartAccess(cart.id, {
      userId: opts.userId,
      guestToken: opts.guestToken,
    });

    if (cart.customerId && cart.customerId !== customerId) {
      // Guest cart may already be unbound; registered carts must match
      if (!isGuest) throw new UnauthorizedException('Cart access denied');
    }
    if (!cart.items.length) throw new BadRequestException('Cart is empty');

    if (!cart.customerId || cart.customerId !== customerId) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: {
          customerId,
          guestToken: isGuest ? cart.guestToken : null,
          currency: parsed.data.currency as Currency,
        },
      });
    } else if (cart.currency !== parsed.data.currency) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { currency: parsed.data.currency as Currency },
      });
    }

    const cartDto = await this.cartService.getOrCreate({
      cartId: cart.id,
      userId: opts.userId,
      guestToken: opts.guestToken,
      currency: parsed.data.currency as Currency,
    });

    for (const item of cartDto.items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });
      if (
        !variant ||
        !variant.isActive ||
        variant.product.status !== ProductStatus.ACTIVE ||
        variant.stock < item.quantity
      ) {
        throw new BadRequestException(`Insufficient stock for ${item.productName}`);
      }
    }

    const currency = parsed.data.currency as Currency;
    const market = await this.marketsService.getByCode(
      marketCodeFromCurrencyValue(currency),
    );
    const settings = await this.settingsService.getByCurrency(currency);
    const discount = cartDto.discount;
    const methods = await this.settingsService.listMethodsByCurrency(true, currency);
    const totals = this.settingsService.buildTotals({
      settings,
      currency,
      country: shippingAddress.country,
      subtotal: cartDto.subtotal,
      discount,
      methods,
      shippingMethodId: parsed.data.shippingMethodId,
      coupon: cartDto.coupon ?? null,
    });
    const shipping = totals.shipping;
    const taxAmount = totals.taxAmount;
    const total = totals.total;
    const number = `LM-${Date.now().toString(36).toUpperCase()}`;

    let couponId: string | null = null;
    let couponCode: string | null = null;
    if (cartDto.coupon) {
      const coupon = await this.couponsService.findByCode(cartDto.coupon.code, cartDto.currency);
      if (!coupon) throw new BadRequestException('Invalid coupon code');
      await this.couponsService.assertApplicable(coupon, {
        subtotal: cartDto.subtotal,
        currency,
        customerId,
        lines: cartDto.items.map((i) => ({
          productId: i.productId,
          lineTotal: i.lineTotal,
        })),
      });
      couponId = coupon.id;
      couponCode = coupon.code;
    }

    const loyaltyPointsRedeemed = cartDto.loyalty?.pointsToRedeem ?? 0;
    if (loyaltyPointsRedeemed > 0) {
      if (isGuest) {
        throw new BadRequestException('Sign in to redeem loyalty points');
      }
      if (!settings.loyaltyEnabled) {
        throw new BadRequestException('Loyalty program is disabled');
      }
    }

    const shippingPhone =
      shippingAddress.phone?.trim() || contactPhone || null;

    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            number,
            customerId,
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.UNPAID,
            currency,
            locale: (parsed.data.locale ?? 'en') as Locale,
            marketId: market.id,
            subtotal: cartDto.subtotal,
            discount,
            shippingAmount: shipping.amount,
            taxAmount,
            total,
            shippingZone: shipping.zone as ShippingZone,
            shippingMethodId: shipping.methodId ?? null,
            shippingMethodCode: shipping.methodCode ?? null,
            shippingMethodName: shipping.methodName ?? null,
            shippingFullName: shippingAddress.fullName,
            shippingLine1: shippingAddress.line1,
            shippingLine2: shippingAddress.line2 ?? null,
            shippingCity: shippingAddress.city,
            shippingRegion: shippingAddress.region ?? null,
            shippingPostalCode: shippingAddress.postalCode,
            shippingCountry: shippingAddress.country.toUpperCase(),
            shippingPhone,
            guestAccessToken,
            idempotencyKey,
            couponId,
            couponCode,
            loyaltyPointsRedeemed,
            items: {
              create: cartDto.items.map((item) => ({
                variantId: item.variantId,
                productName: item.productName,
                variantName: item.variantName,
                sku: item.sku,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: { items: true },
        });

        if (loyaltyPointsRedeemed > 0) {
          await this.loyaltyService.debitRedeemInTx(tx, {
            customerId,
            orderId: created.id,
            points: loyaltyPointsRedeemed,
            orderNumber: created.number,
            settings,
          });
        }

        return created;
      });
    } catch (err) {
      // Concurrent retry with the same idempotency key.
      if (
        idempotencyKey &&
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        const existing = await this.prisma.order.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });
        if (existing) {
          return this.replayIdempotentCheckout(existing, {
            userId: opts.userId,
            guestToken: opts.guestToken,
          });
        }
      }
      throw err;
    }

    if (!isGuest && parsed.data.saveAddress && !parsed.data.addressId) {
      await this.addressesService.saveFromShipping(customerId, shippingAddress, {
        label: parsed.data.addressLabel ?? null,
        makeDefault: false,
      });
    }

    await this.ordersService.recordTimelineEvent(
      order.id,
      OrderStatus.PENDING,
      OrderTimelineActorType.SYSTEM,
      couponCode
        ? `Order placed (coupon ${couponCode})${isGuest ? ' — guest' : ''}`
        : isGuest
          ? 'Order placed — guest'
          : 'Order placed',
    );

    const requested =
      parsed.data.paymentMethod === 'CARD'
        ? 'CARD'
        : parsed.data.paymentMethod === 'COD'
          ? 'COD'
          : isGuest
            ? 'COD'
            : 'CARD';

    if (requested === 'COD') {
      if (!settings.cashOnDeliveryEnabled) {
        throw new BadRequestException('Cash on delivery is disabled');
      }
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentProvider: PaymentProvider.COD },
      });
      const codOrder = await this.finalizeCodOrder(order.id);
      return this.ordersService.mapOrder(codOrder, { guestAccessToken });
    }

    if (!settings.cardPaymentEnabled) {
      throw new BadRequestException('Card payment is disabled');
    }

    const cardProvider = this.settingsService.cardProviderForCurrency(settings, currency);
    if (!cardProvider) {
      throw new BadRequestException(
        currency === Currency.USD || currency === Currency.AED
          ? 'Stripe card payments are not configured for this currency'
          : 'Konnect card payments are not configured for this currency',
      );
    }

    // total already includes tax (subtotal - discount + shipping + tax)
    if (cardProvider === PaymentProvider.STRIPE) {
      const secret = this.settingsService.resolveStripeSecret(settings);
      const stripe = this.stripeClient(secret);
      if (!stripe) {
        throw new BadRequestException('Stripe secret key is missing');
      }
      const intent = await stripe.paymentIntents.create({
        amount: total,
        currency: currency.toLowerCase(),
        metadata: {
          orderId: order.id,
          orderNumber: order.number,
          taxAmount: String(taxAmount),
        },
        automatic_payment_methods: { enabled: true },
      });
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          stripePaymentIntentId: intent.id,
          paymentProvider: PaymentProvider.STRIPE,
        },
      });
      return this.ordersService.mapOrder(
        { ...order, paymentProvider: PaymentProvider.STRIPE, stripePaymentIntentId: intent.id },
        {
          clientSecret: intent.client_secret,
          guestAccessToken,
        },
      );
    }

    // Konnect (TND and other non-USD/AED)
    const publicBase =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
      process.env.NEST_PUBLIC_URL?.replace(/\/$/, '') ||
      'http://localhost:4000/api';
    const storefront =
      process.env.STOREFRONT_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const successUrl = `${storefront}/checkout/confirmation?orderId=${encodeURIComponent(order.id)}&provider=konnect`;
    const failUrl = `${storefront}/checkout?payment=failed`;
    const webhookUrl = `${publicBase}/payments/konnect/webhook`;

    const konnect = await this.konnectService.initPayment(settings, {
      amount: total,
      currency: currency.toUpperCase(),
      orderId: order.id,
      orderNumber: order.number,
      description: `Selfieface order ${order.number} (incl. tax ${taxAmount})`,
      successUrl,
      failUrl,
      webhookUrl,
      phoneNumber: shippingPhone,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProvider: PaymentProvider.KONNECT,
        konnectPaymentRef: konnect.paymentRef,
      },
    });

    return this.ordersService.mapOrder(
      {
        ...order,
        paymentProvider: PaymentProvider.KONNECT,
        konnectPaymentRef: konnect.paymentRef,
      },
      {
        guestAccessToken,
        payUrl: konnect.payUrl,
      },
    );
  }

  /**
   * Resume an unpaid Stripe PaymentIntent so the storefront can remount Payment Element
   * after refresh or 3DS return. If the intent already succeeded, finalize the order.
   */
  async getPaymentClientSecret(
    orderId: string,
    opts: { userId?: string | null; guestAccessToken?: string | null },
  ): Promise<{ clientSecret: string; paymentIntentId: string; alreadyPaid?: boolean }> {
    const order = await this.assertOrderAccess(orderId, opts);
    if (order.paymentStatus === PaymentStatus.CAPTURED) {
      throw new BadRequestException('Order is already paid');
    }
    const settings = await this.settingsService.getByCurrency(order.currency);
    const stripe = this.stripeClient(this.settingsService.resolveStripeSecret(settings));
    if (!stripe || !order.stripePaymentIntentId) {
      throw new BadRequestException('Stripe payment is not available for this order');
    }

    const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (!intent.client_secret) {
      throw new BadRequestException('Missing payment client secret');
    }

    if (intent.status === 'succeeded' || intent.status === 'requires_capture') {
      await this.finalizePaidOrder(order.id);
      return {
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        alreadyPaid: true,
      };
    }

    if (
      intent.status !== 'requires_payment_method' &&
      intent.status !== 'requires_confirmation' &&
      intent.status !== 'requires_action'
    ) {
      throw new BadRequestException(`Payment cannot be resumed (${intent.status})`);
    }

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    };
  }

  async confirmPayment(
    orderId: string,
    input: unknown,
    opts: { userId?: string | null; guestAccessToken?: string | null },
  ): Promise<OrderDto> {
    const parsed = confirmPaymentSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const order = await this.assertOrderAccess(orderId, opts);
    if (order.paymentStatus === PaymentStatus.CAPTURED) {
      const full = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      return this.ordersService.mapOrder(full);
    }

    // Konnect confirmation / return
    if (
      order.paymentProvider === PaymentProvider.KONNECT ||
      parsed.data.paymentRef ||
      order.konnectPaymentRef
    ) {
      return this.confirmKonnectPayment(order.id, parsed.data.paymentRef ?? order.konnectPaymentRef);
    }

    // COD orders are already reserved (AUTHORIZED) — not card-captured here
    if (
      order.paymentStatus === PaymentStatus.AUTHORIZED &&
      !order.stripePaymentIntentId
    ) {
      const full = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      return this.ordersService.mapOrder(full, {
        guestAccessToken: opts.guestAccessToken ? order.guestAccessToken : null,
      });
    }

    const settings = await this.settingsService.getByCurrency(order.currency);
    const stripe = this.stripeClient(this.settingsService.resolveStripeSecret(settings));
    if (!stripe) {
      return this.finalizePaidOrder(order.id);
    }

    const intentId =
      parsed.data.paymentIntentId === 'dev'
        ? order.stripePaymentIntentId
        : parsed.data.paymentIntentId;

    if (!intentId) {
      throw new BadRequestException('Missing payment intent');
    }

    const intent = await stripe.paymentIntents.retrieve(intentId);
    if (intent.status !== 'succeeded' && intent.status !== 'requires_capture') {
      throw new BadRequestException(`Payment not complete (${intent.status})`);
    }
    if (intent.metadata?.orderId && intent.metadata.orderId !== order.id) {
      throw new BadRequestException('Payment intent does not match order');
    }

    return this.finalizePaidOrder(order.id);
  }

  async confirmKonnectPayment(orderId: string, paymentRef?: string | null): Promise<OrderDto> {
    if (!paymentRef) {
      throw new BadRequestException('Missing Konnect payment reference');
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const settings = await this.settingsService.getByCurrency(order.currency);
    const completed = await this.konnectService.isPaymentCompleted(settings, paymentRef);
    if (!completed) {
      throw new BadRequestException('Konnect payment is not completed yet');
    }
    await this.prisma.order.update({
      where: { id: orderId },
      data: { konnectPaymentRef: paymentRef },
    });
    return this.finalizePaidOrder(orderId);
  }

  async handleKonnectWebhook(paymentRef: string): Promise<{ ok: boolean; orderId?: string }> {
    if (!paymentRef) throw new BadRequestException('Missing payment_ref');
    const order = await this.prisma.order.findFirst({
      where: { konnectPaymentRef: paymentRef },
    });
    if (!order) {
      // Also try matching by scanning unpaid konnect orders — payment_ref may arrive first
      throw new NotFoundException('Order not found for Konnect payment');
    }
    if (order.paymentStatus === PaymentStatus.CAPTURED) {
      return { ok: true, orderId: order.id };
    }
    await this.confirmKonnectPayment(order.id, paymentRef);
    return { ok: true, orderId: order.id };
  }

  private async findOrCreateGuestCustomer(phone: string, email?: string | null) {
    const existing = await this.prisma.customer.findFirst({
      where: { phone, isGuest: true, userId: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      if (email && existing.email !== email) {
        return this.prisma.customer.update({
          where: { id: existing.id },
          data: { email },
        });
      }
      return existing;
    }
    return this.prisma.customer.create({
      data: {
        phone,
        email: email ?? null,
        isGuest: true,
      },
    });
  }

  private async replayIdempotentCheckout(
    order: {
      id: string;
      customerId: string;
      paymentStatus: PaymentStatus;
      paymentProvider: string | null;
      stripePaymentIntentId: string | null;
      konnectPaymentRef: string | null;
      guestAccessToken: string | null;
      currency: Currency;
      total: number;
      taxAmount: number;
      number: string;
      items: unknown[];
    },
    opts: { userId?: string | null; guestToken?: string | null },
  ): Promise<OrderDto> {
    await this.assertOrderAccess(order.id, {
      userId: opts.userId,
      guestAccessToken: order.guestAccessToken,
    }).catch(async () => {
      // Guest retries may not send the prior guestAccessToken; allow match via
      // customer ownership when cart guest token maps to the same guest customer.
      if (opts.userId) throw new UnauthorizedException('Order access denied');
      if (!opts.guestToken) throw new UnauthorizedException('Order access denied');
      const cart = await this.prisma.cart.findFirst({
        where: { guestToken: opts.guestToken },
      });
      if (!cart || cart.customerId !== order.customerId) {
        throw new UnauthorizedException('Order access denied');
      }
    });

    if (
      order.paymentProvider === PaymentProvider.COD ||
      order.paymentStatus === PaymentStatus.AUTHORIZED ||
      order.paymentStatus === PaymentStatus.CAPTURED
    ) {
      return this.ordersService.mapOrder(order as never, {
        guestAccessToken: order.guestAccessToken,
      });
    }

    if (order.paymentProvider === PaymentProvider.STRIPE && order.stripePaymentIntentId) {
      const settings = await this.settingsService.getByCurrency(order.currency);
      const secret = this.settingsService.resolveStripeSecret(settings);
      const stripe = this.stripeClient(secret);
      if (stripe) {
        const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
        return this.ordersService.mapOrder(order as never, {
          clientSecret: intent.client_secret,
          guestAccessToken: order.guestAccessToken,
        });
      }
    }

    return this.ordersService.mapOrder(order as never, {
      guestAccessToken: order.guestAccessToken,
    });
  }

  private async assertOrderAccess(
    orderId: string,
    opts: { userId?: string | null; guestAccessToken?: string | null },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (opts.userId) {
      const customer = await this.prisma.customer.findUnique({
        where: { userId: opts.userId },
      });
      if (!customer || order.customerId !== customer.id) {
        throw new NotFoundException('Order not found');
      }
      return order;
    }

    if (
      opts.guestAccessToken &&
      order.guestAccessToken &&
      opts.guestAccessToken === order.guestAccessToken
    ) {
      return order;
    }

    throw new UnauthorizedException('Order access denied');
  }

  /**
   * Cash on delivery: reserve inventory and accept for fulfillment while
   * payment stays outstanding (AUTHORIZED = committed, pay on delivery).
   */
  private async finalizeCodOrder(orderId: string) {
    // Remote Postgres round-trips routinely exceed Prisma's 5s interactive tx default.
    let newlyFinalized = false;
    const lowStockEvents: Array<{
      previousStock: number;
      nextStock: number;
      sku: string;
      variantName: string;
      productName: string;
    }> = [];
    const result = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { items: true },
        });
        if (
          current.paymentStatus === PaymentStatus.AUTHORIZED ||
          current.paymentStatus === PaymentStatus.CAPTURED
        ) {
          return current;
        }

        for (const item of current.items) {
          try {
            const events = await deductSellableStock(tx, {
              variantId: item.variantId,
              quantity: item.quantity,
              note: `Order ${current.number} (COD)`,
              orderItemId: item.id,
            });
            lowStockEvents.push(...events);
          } catch (err) {
            throw new BadRequestException(
              err instanceof Error ? err.message : `Insufficient stock for ${item.sku}`,
            );
          }
        }

        if (current.couponId) {
          const existingRedemption = await tx.couponRedemption.findUnique({
            where: { orderId },
          });
          if (!existingRedemption) {
            await this.couponsService.recordRedemption(tx, {
              couponId: current.couponId,
              customerId: current.customerId,
              orderId,
            });
          }
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.AUTHORIZED,
            status: OrderStatus.PROCESSING,
          },
          include: { items: true },
        });

        if (current.status === OrderStatus.PENDING) {
          await this.ordersService.recordTimelineEvent(
            orderId,
            OrderStatus.PROCESSING,
            OrderTimelineActorType.SYSTEM,
            'Cash on delivery — stock reserved',
            tx,
          );
        }

        const cart = await tx.cart.findFirst({ where: { customerId: current.customerId } });
        if (cart) {
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          await tx.cart.update({
            where: { id: cart.id },
            data: { couponId: null, loyaltyPointsToRedeem: 0 },
          });
        }

        newlyFinalized = true;
        return updated;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    if (newlyFinalized) {
      void this.orderMail.sendConfirmation(orderId);
      void this.notifyLowStockCrossings(lowStockEvents);
      void this.loyaltyService.earnForCommittedOrder(orderId);
    }

    return result;
  }

  private async finalizePaidOrder(orderId: string): Promise<OrderDto> {
    let newlyFinalized = false;
    const lowStockEvents: Array<{
      previousStock: number;
      nextStock: number;
      sku: string;
      variantName: string;
      productName: string;
    }> = [];
    const order = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      if (current.paymentStatus === PaymentStatus.CAPTURED) return current;

      for (const item of current.items) {
        try {
          const events = await deductSellableStock(tx, {
            variantId: item.variantId,
            quantity: item.quantity,
            note: `Order ${current.number}`,
            orderItemId: item.id,
          });
          lowStockEvents.push(...events);
        } catch (err) {
          throw new BadRequestException(
            err instanceof Error ? err.message : `Insufficient stock for ${item.sku}`,
          );
        }
      }

      if (current.couponId) {
        const existingRedemption = await tx.couponRedemption.findUnique({
          where: { orderId },
        });
        if (!existingRedemption) {
          await this.couponsService.recordRedemption(tx, {
            couponId: current.couponId,
            customerId: current.customerId,
            orderId,
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.CAPTURED,
          status: OrderStatus.PROCESSING,
        },
        include: { items: true },
      });

      if (current.status === OrderStatus.PENDING) {
        await this.ordersService.recordTimelineEvent(
          orderId,
          OrderStatus.PROCESSING,
          OrderTimelineActorType.SYSTEM,
          'Payment captured',
          tx,
        );
      }

      const cart = await tx.cart.findFirst({ where: { customerId: current.customerId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({
          where: { id: cart.id },
          data: { couponId: null, loyaltyPointsToRedeem: 0 },
        });
      }

      newlyFinalized = true;
      return updated;
    }, { maxWait: 10_000, timeout: 20_000 });

    if (newlyFinalized) {
      void this.orderMail.sendConfirmation(orderId);
      void this.notifyLowStockCrossings(lowStockEvents);
      void this.loyaltyService.earnForCommittedOrder(orderId);
    }

    return this.ordersService.mapOrder(order);
  }

  private async notifyLowStockCrossings(
    events: Array<{
      previousStock: number;
      nextStock: number;
      sku: string;
      variantName: string;
      productName: string;
    }>,
  ) {
    if (!events.length) return;
    const settings = await this.settingsService.getByCurrency(Currency.USD);
    const threshold = settings.lowStockThreshold;
    for (const event of events) {
      if (!crossedLowStockThreshold(event.previousStock, event.nextStock, threshold)) {
        continue;
      }
      await this.mail.notifyAdminLowStock({
        productName: event.productName,
        variantName: event.variantName,
        sku: event.sku,
        stock: event.nextStock,
        threshold,
      });
    }
  }
}
