import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Currency, ShippingZone, type ShippingMethod, type StoreSettings } from '@prisma/client';
import {
  Currency as SharedCurrency,
  MarketCode,
  PaymentProvider,
  ShippingZone as SharedShippingZone,
  type CheckoutTotalsDto,
  type PaymentOptionsDto,
  type ShippingMethodDto,
  type ShippingMethodQuoteDto,
  type ShippingQuoteDto,
  type StoreContactDto,
  type StoreSettingsDto,
} from '@lumea/types';
import { storeSettingsUpdateSchema } from '@lumea/validation';
import {
  marketCodeFromCurrencyValue,
  parseMarketCode,
} from '../markets/market.util';
import { MarketsService } from '../markets/markets.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService,
  ) {}

  /** Settings for a market window (default OTHER). */
  async get(marketCode: MarketCode | string = MarketCode.OTHER): Promise<StoreSettings> {
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);
    return this.prisma.storeSettings.upsert({
      where: { id: code },
      create: { id: code, marketId: market.id },
      update: {},
    });
  }

  async getByCurrency(currency?: string | null): Promise<StoreSettings> {
    return this.get(marketCodeFromCurrencyValue(currency));
  }

  async listMethods(
    activeOnly = false,
    marketCode: MarketCode | string = MarketCode.OTHER,
  ): Promise<ShippingMethod[]> {
    const market = await this.marketsService.getByCode(marketCode);
    return this.prisma.shippingMethod.findMany({
      where: {
        marketId: market.id,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listMethodsByCurrency(
    activeOnly = false,
    currency?: string | null,
  ): Promise<ShippingMethod[]> {
    return this.listMethods(activeOnly, marketCodeFromCurrencyValue(currency));
  }

  async getDto(marketCode: MarketCode | string = MarketCode.OTHER): Promise<StoreSettingsDto> {
    const code = parseMarketCode(marketCode);
    const [s, methods] = await Promise.all([this.get(code), this.listMethods(false, code)]);
    return this.toDto(s, methods, code);
  }

  async getPublicContact(currency?: string): Promise<StoreContactDto> {
    const s = await this.getByCurrency(currency);
    return {
      whatsapp: s.contactWhatsapp,
      phone: s.contactPhone,
      facebook: s.contactFacebook,
      instagram: s.contactInstagram,
      email: s.contactEmail,
    };
  }

  async update(
    input: unknown,
    marketCode: MarketCode | string = MarketCode.OTHER,
  ): Promise<StoreSettingsDto> {
    const parsed = storeSettingsUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const code = parseMarketCode(marketCode);
    const market = await this.marketsService.getByCode(code);

    const {
      shippingMethods,
      stripeSecretKey,
      stripePublishableKey,
      konnectApiKey,
      konnectWalletId,
      ...settingsData
    } = parsed.data;

    const existing = await this.get(code);
    const secretPatch: Partial<StoreSettings> = {};

    if (stripeSecretKey !== undefined) {
      if (stripeSecretKey === null || stripeSecretKey === '') {
        // keep existing when blank
      } else {
        secretPatch.stripeSecretKey = stripeSecretKey;
      }
    }
    if (stripePublishableKey !== undefined) {
      if (stripePublishableKey === null || stripePublishableKey === '') {
        // keep
      } else {
        secretPatch.stripePublishableKey = stripePublishableKey;
      }
    }
    if (konnectApiKey !== undefined) {
      if (konnectApiKey === null || konnectApiKey === '') {
        // keep
      } else {
        secretPatch.konnectApiKey = konnectApiKey;
      }
    }
    if (konnectWalletId !== undefined) {
      secretPatch.konnectWalletId =
        konnectWalletId === null || konnectWalletId === ''
          ? existing.konnectWalletId
          : konnectWalletId;
      if (konnectWalletId === '') {
        // keep existing
        delete secretPatch.konnectWalletId;
      }
    }

    const s = await this.prisma.storeSettings.upsert({
      where: { id: code },
      create: { id: code, marketId: market.id, ...settingsData, ...secretPatch },
      update: { ...settingsData, ...secretPatch },
    });

    if (shippingMethods?.length) {
      const owned = await this.prisma.shippingMethod.findMany({
        where: {
          marketId: market.id,
          id: { in: shippingMethods.map((m) => m.id) },
        },
        select: { id: true },
      });
      if (owned.length !== shippingMethods.length) {
        throw new BadRequestException('One or more shipping methods are not in this market');
      }
      await this.prisma.$transaction(
        shippingMethods.map((m) =>
          this.prisma.shippingMethod.update({
            where: { id: m.id },
            data: {
              name: m.name,
              description: m.description ?? null,
              price: m.price,
              ...(m.sortOrder !== undefined ? { sortOrder: m.sortOrder } : {}),
              ...(m.isActive !== undefined ? { isActive: m.isActive } : {}),
              ...(m.eligibleForFreeShipping !== undefined
                ? { eligibleForFreeShipping: m.eligibleForFreeShipping }
                : {}),
              estimatedDaysMin: m.estimatedDaysMin ?? null,
              estimatedDaysMax: m.estimatedDaysMax ?? null,
            },
          }),
        ),
      );
    }

    const methods = await this.listMethods(false, code);
    return this.toDto(s, methods, code);
  }

  resolveStripeSecret(settings: StoreSettings): string | null {
    return settings.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || null;
  }

  resolveStripePublishable(settings: StoreSettings): string | null {
    return (
      settings.stripePublishableKey?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
      process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
      null
    );
  }

  resolveKonnectApiKey(settings: StoreSettings): string | null {
    return settings.konnectApiKey?.trim() || process.env.KONNECT_API_KEY?.trim() || null;
  }

  resolveKonnectWalletId(settings: StoreSettings): string | null {
    return settings.konnectWalletId?.trim() || process.env.KONNECT_WALLET_ID?.trim() || null;
  }

  stripeConfigured(settings: StoreSettings): boolean {
    return Boolean(this.resolveStripeSecret(settings) && this.resolveStripePublishable(settings));
  }

  konnectConfigured(settings: StoreSettings): boolean {
    return Boolean(this.resolveKonnectApiKey(settings) && this.resolveKonnectWalletId(settings));
  }

  /**
   * USD/AED → Stripe; other currencies (TND) → Konnect.
   */
  cardProviderForCurrency(
    settings: StoreSettings,
    currency: Currency | string,
  ): PaymentProvider.STRIPE | PaymentProvider.KONNECT | null {
    if (!settings.cardPaymentEnabled) return null;
    const code = String(currency).toUpperCase();
    if (code === 'USD' || code === 'AED') {
      if (!settings.stripeEnabled || !this.stripeConfigured(settings)) return null;
      return PaymentProvider.STRIPE;
    }
    if (!settings.konnectEnabled || !this.konnectConfigured(settings)) return null;
    return PaymentProvider.KONNECT;
  }

  async getPaymentOptions(currency?: string): Promise<PaymentOptionsDto> {
    const settings = await this.getByCurrency(currency);
    const cur = (currency ?? 'USD').toUpperCase() as Currency;
    const cardProvider = this.cardProviderForCurrency(settings, cur);
    return {
      cashEnabled: settings.cashOnDeliveryEnabled,
      cardEnabled: settings.cardPaymentEnabled && cardProvider != null,
      taxRateBps: settings.taxRateBps,
      cardProvider,
      stripePublishableKey:
        cardProvider === PaymentProvider.STRIPE
          ? this.resolveStripePublishable(settings)
          : null,
      stripeConfigured: this.stripeConfigured(settings),
      konnectConfigured: this.konnectConfigured(settings),
    };
  }

  resolveZone(settings: StoreSettings, country: string): ShippingZone {
    const code = country.toUpperCase();
    const domestic = settings.domesticCountries
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    return domestic.includes(code) ? ShippingZone.DOMESTIC : ShippingZone.INTERNATIONAL;
  }

  freeShippingEnabled(settings: StoreSettings, _currency?: Currency | string): boolean {
    return settings.freeShippingEnabled;
  }

  /**
   * Threshold in minor units for this market’s currency. Returns 0 when free
   * shipping is disabled or the configured threshold is 0.
   */
  freeShippingThreshold(settings: StoreSettings, _currency?: Currency): number {
    if (!this.freeShippingEnabled(settings)) return 0;
    return settings.freeShippingThreshold > 0 ? settings.freeShippingThreshold : 0;
  }

  methodBasePrice(method: ShippingMethod, _currency?: Currency): number {
    return method.price;
  }

  legacyFlatRate(settings: StoreSettings, zone: ShippingZone, _currency?: Currency): number {
    return zone === ShippingZone.DOMESTIC
      ? settings.domesticShipping
      : settings.internationalShipping;
  }

  toSharedCurrency(currency: Currency): SharedCurrency {
    if (currency === Currency.TND) return SharedCurrency.TND;
    if (currency === Currency.AED) return SharedCurrency.AED;
    return SharedCurrency.USD;
  }

  quoteMethods(
    settings: StoreSettings,
    methods: ShippingMethod[],
    currency: Currency,
    subtotal: number,
  ): ShippingMethodQuoteDto[] {
    const threshold = this.freeShippingThreshold(settings, currency);
    const qualifies = threshold > 0 && subtotal >= threshold;
    const sharedCurrency = this.toSharedCurrency(currency);

    return methods.map((method) => {
      const baseAmount = this.methodBasePrice(method, currency);
      const freeShippingApplied = qualifies && method.eligibleForFreeShipping;
      return {
        id: method.id,
        code: method.code,
        name: method.name,
        description: method.description,
        amount: freeShippingApplied ? 0 : baseAmount,
        baseAmount,
        freeShippingApplied,
        eligibleForFreeShipping: method.eligibleForFreeShipping,
        currency: sharedCurrency,
        estimatedDaysMin: method.estimatedDaysMin,
        estimatedDaysMax: method.estimatedDaysMax,
      };
    });
  }

  quoteShipping(
    settings: StoreSettings,
    country: string,
    currency: Currency,
    subtotal: number,
    methods: ShippingMethod[],
    shippingMethodId?: string | null,
  ): { shipping: ShippingQuoteDto; methods: ShippingMethodQuoteDto[] } {
    const zone = this.resolveZone(settings, country);
    const quoted = this.quoteMethods(settings, methods, currency, subtotal);

    const selected =
      (shippingMethodId ? quoted.find((m) => m.id === shippingMethodId) : undefined) ??
      quoted[0];

    if (!selected && methods.length === 0) {
      const threshold = this.freeShippingThreshold(settings, currency);
      const free = threshold > 0 && subtotal >= threshold;
      const rate = this.legacyFlatRate(settings, zone, currency);
      const shipping: ShippingQuoteDto = {
        zone:
          zone === ShippingZone.DOMESTIC
            ? SharedShippingZone.DOMESTIC
            : SharedShippingZone.INTERNATIONAL,
        amount: free ? 0 : rate,
        currency: this.toSharedCurrency(currency),
        freeShippingApplied: free,
        methodId: null,
        methodCode: null,
        methodName: null,
      };
      return { shipping, methods: [] };
    }

    if (!selected) {
      throw new NotFoundException('Shipping method not found');
    }

    if (shippingMethodId && !quoted.some((m) => m.id === shippingMethodId)) {
      throw new BadRequestException('Invalid shipping method');
    }

    return {
      shipping: {
        zone:
          zone === ShippingZone.DOMESTIC
            ? SharedShippingZone.DOMESTIC
            : SharedShippingZone.INTERNATIONAL,
        amount: selected.amount,
        currency: this.toSharedCurrency(currency),
        freeShippingApplied: selected.freeShippingApplied,
        methodId: selected.id,
        methodCode: selected.code,
        methodName: selected.name,
      },
      methods: quoted,
    };
  }

  buildTotals(input: {
    settings: StoreSettings;
    currency: Currency;
    country: string;
    subtotal: number;
    discount: number;
    methods: ShippingMethod[];
    shippingMethodId?: string | null;
    coupon?: CheckoutTotalsDto['coupon'];
  }): CheckoutTotalsDto {
    const afterDiscount = Math.max(0, input.subtotal - input.discount);
    const { shipping, methods } = this.quoteShipping(
      input.settings,
      input.country,
      input.currency,
      afterDiscount,
      input.methods,
      input.shippingMethodId,
    );
    // Tax applies on merchandise + shipping (included in charged payment total).
    const taxAmount = this.taxAmount(input.settings, afterDiscount + shipping.amount);
    const threshold = this.freeShippingThreshold(input.settings, input.currency);
    return {
      currency: this.toSharedCurrency(input.currency),
      subtotal: input.subtotal,
      discount: input.discount,
      shippingAmount: shipping.amount,
      taxAmount,
      total: afterDiscount + shipping.amount + taxAmount,
      shipping,
      shippingMethods: methods,
      freeShippingThreshold: threshold,
      amountUntilFreeShipping:
        threshold > 0 ? Math.max(0, threshold - afterDiscount) : 0,
      coupon: input.coupon ?? null,
    };
  }

  taxAmount(settings: StoreSettings, taxable: number): number {
    if (settings.taxRateBps <= 0) return 0;
    return Math.round((taxable * settings.taxRateBps) / 10000);
  }

  private toDto(
    s: StoreSettings,
    methods: ShippingMethod[],
    marketCode: MarketCode = MarketCode.OTHER,
  ): StoreSettingsDto {
    return {
      id: s.id,
      marketId: s.marketId,
      marketCode,
      taxRateBps: s.taxRateBps,
      freeShippingEnabled: s.freeShippingEnabled,
      freeShippingThreshold: s.freeShippingThreshold,
      domesticShipping: s.domesticShipping,
      internationalShipping: s.internationalShipping,
      domesticCountries: s.domesticCountries,
      cashOnDeliveryEnabled: s.cashOnDeliveryEnabled,
      cardPaymentEnabled: s.cardPaymentEnabled,
      stripeEnabled: s.stripeEnabled,
      stripeSecretKeySet: Boolean(this.resolveStripeSecret(s)),
      stripePublishableKey: this.resolveStripePublishable(s),
      konnectEnabled: s.konnectEnabled,
      konnectApiKeySet: Boolean(this.resolveKonnectApiKey(s)),
      konnectWalletId: s.konnectWalletId,
      konnectSandbox: s.konnectSandbox,
      contactWhatsapp: s.contactWhatsapp,
      contactFacebook: s.contactFacebook,
      contactInstagram: s.contactInstagram,
      contactPhone: s.contactPhone,
      contactEmail: s.contactEmail,
      lowStockThreshold: s.lowStockThreshold,
      loyaltyEnabled: s.loyaltyEnabled,
      loyaltyPointsPerMajorUnit: s.loyaltyPointsPerMajorUnit,
      loyaltyPointValueMinor: s.loyaltyPointValueMinor,
      loyaltyMinOrderMinor: s.loyaltyMinOrderMinor,
      loyaltyMaxRedeemBps: s.loyaltyMaxRedeemBps,
      loyaltySignupBonusPoints: s.loyaltySignupBonusPoints,
      shippingMethods: methods.map((m): ShippingMethodDto => ({
        id: m.id,
        code: m.code,
        name: m.name,
        description: m.description,
        price: m.price,
        sortOrder: m.sortOrder,
        isActive: m.isActive,
        eligibleForFreeShipping: m.eligibleForFreeShipping,
        estimatedDaysMin: m.estimatedDaysMin,
        estimatedDaysMax: m.estimatedDaysMax,
      })),
    };
  }
}
