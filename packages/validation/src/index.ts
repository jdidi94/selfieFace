import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const oauthExchangeSchema = z.object({
  code: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type OAuthExchangeInput = z.infer<typeof oauthExchangeSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const healthQuerySchema = z.object({}).strict();
export type HealthQuery = z.infer<typeof healthQuerySchema>;

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug');

export const currencySchema = z.enum(['USD', 'TND', 'AED']);
export const marketCodeSchema = z.enum(['AE', 'TN', 'OTHER']);
export const localeSchema = z.enum(['en', 'ar', 'fr']);

export const categoryTranslationSchema = z.object({
  locale: localeSchema,
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

export const brandTranslationSchema = z.object({
  locale: localeSchema,
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

export const productTranslationSchema = z.object({
  locale: localeSchema,
  name: z.string().min(1),
  shortDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  howToUse: z.string().optional().nullable(),
  suitableFor: z.string().optional().nullable(),
});

function requireEnglishTranslation(
  translations: { locale: string }[] | undefined,
  ctx: z.RefinementCtx,
) {
  if (!translations?.some((t) => t.locale === 'en')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'English (en) translation is required',
      path: ['translations'],
    });
  }
}

export const categoryUpsertSchema = z
  .object({
    /** @deprecated prefer translations[].name for en */
    name: z.string().min(1).optional(),
    slug: slugSchema.optional(),
    description: z.string().optional().nullable(),
    sortOrder: z.number().int().optional(),
    translations: z.array(categoryTranslationSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.translations?.length && !val.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide translations or a name',
        path: ['translations'],
      });
      return;
    }
    if (val.translations?.length) requireEnglishTranslation(val.translations, ctx);
  });

export const brandUpsertSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: slugSchema.optional(),
    description: z.string().optional().nullable(),
    imageUrl: z
      .union([z.string().url(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' ? null : v)),
    translations: z.array(brandTranslationSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.translations?.length && !val.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide translations or a name',
        path: ['translations'],
      });
      return;
    }
    if (val.translations?.length) requireEnglishTranslation(val.translations, ctx);
  });

export const variantPriceInputSchema = z.object({
  currency: currencySchema,
  amount: z.number().int().nonnegative(),
  compareAtAmount: z.number().int().nonnegative().optional().nullable(),
});

export const variantInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    sku: z.string().min(1),
    /** @deprecated prefer `prices` — kept for single-currency admin shorthand as USD */
    price: z.number().int().nonnegative().optional(),
    compareAtPrice: z.number().int().nonnegative().optional().nullable(),
    prices: z.array(variantPriceInputSchema).optional(),
    stock: z.number().int().nonnegative().optional(),
    weightGrams: z.number().int().nonnegative().optional().nullable(),
    barcode: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.prices?.length && val.price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide prices (USD/TND/AED) or a USD price',
        path: ['prices'],
      });
    }
  });

export const productFieldsSchema = z.object({
  name: z.string().min(1).optional(),
  slug: slugSchema.optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  kind: z.enum(['PRODUCT', 'PACK']).optional(),
  shortDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  howToUse: z.string().optional().nullable(),
  suitableFor: z.string().optional().nullable(),
  translations: z.array(productTranslationSchema).optional(),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  variants: z.array(variantInputSchema).min(1),
  imageMediaIds: z.array(z.string()).optional(),
  isIncoming: z.boolean().optional(),
  incomingAt: z.coerce.date().optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(24).optional(),
  /** Admin may omit; server assigns from x-market / selected window. */
  marketCode: marketCodeSchema.optional(),
  /** Required when kind=PACK: component variants + quantities. */
  packComponents: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive().max(99).default(1),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
    )
    .max(24)
    .optional(),
});

export const productCreateSchema = productFieldsSchema.superRefine((val, ctx) => {
  if (!val.translations?.length && !val.name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide translations or a name',
      path: ['translations'],
    });
    return;
  }
  if (val.translations?.length) requireEnglishTranslation(val.translations, ctx);
  if ((val.kind ?? 'PRODUCT') === 'PACK' && !(val.packComponents?.length)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Packs require at least one component variant',
      path: ['packComponents'],
    });
  }
});

export const productUpdateSchema = productFieldsSchema
  .partial()
  .extend({
    variants: z.array(variantInputSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.translations?.length) requireEnglishTranslation(val.translations, ctx);
  });

export const productBulkTagsSchema = z
  .object({
    productIds: z.array(z.string().min(1)).min(1).max(100),
    add: z.array(z.string().min(1).max(40)).max(24).optional(),
    remove: z.array(z.string().min(1).max(40)).max(24).optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.add?.length && !val.remove?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one tag to add or remove',
        path: ['add'],
      });
    }
  });

const queryFlagSchema = z
  .union([z.literal('1'), z.literal('true'), z.literal('yes'), z.literal('on'), z.boolean()])
  .optional()
  .transform((v) => v === true || v === '1' || v === 'true' || v === 'yes' || v === 'on');

export const productListQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  /** Filter catalog by product kind (packs vs standard products). */
  kind: z.enum(['PRODUCT', 'PACK']).optional(),
  currency: currencySchema.optional().default('USD'),
  locale: localeSchema.optional().default('en'),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  recommended: queryFlagSchema,
  incoming: queryFlagSchema,
  promotion: queryFlagSchema,
  sort: z.enum(['price', 'name']).optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(48).optional().default(12),
});

export const productPriceRangeQuerySchema = z.object({
  currency: currencySchema.optional().default('USD'),
});

export const productAdminListQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  kind: z.enum(['PRODUCT', 'PACK']).optional(),
  market: marketCodeSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const inventoryAdjustSchema = z.object({
  quantityDelta: z.number().int(),
  reason: z.enum(['SALE', 'RESTOCK', 'ADJUSTMENT', 'RETURN', 'TRANSFER']),
  note: z.string().optional().nullable(),
  /** Defaults to the store default warehouse when omitted. */
  warehouseId: z.string().min(1).optional(),
});

export const inventoryTransferSchema = z.object({
  variantId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  note: z.string().optional().nullable(),
});

export const warehouseUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  code: slugSchema,
  line1: z.string().max(200).optional().nullable(),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(32).optional().nullable(),
  country: z.string().max(2).optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const warehouseUpdateSchema = warehouseUpsertSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'At least one field is required' },
);

export const cartAddItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive().max(99).optional().default(1),
  currency: currencySchema.optional(),
});

export const cartUpdateItemSchema = z.object({
  quantity: z.number().int().positive().max(99),
});

export const cartCurrencySchema = z.object({
  currency: currencySchema,
});

export const cartApplyCouponSchema = z.object({
  code: z.string().min(1).max(64),
});

export const cartApplyLoyaltySchema = z.object({
  points: z.number().int().nonnegative().max(10_000_000),
});

export const shippingAddressSchema = z.object({
  fullName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  region: z.string().optional().nullable(),
  /** Optional for faster checkout; empty string stored when omitted. */
  postalCode: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v == null || !String(v).trim() ? '' : String(v).trim())),
  country: z.string().min(2).max(2),
  phone: z.string().optional().nullable(),
});

export const addressUpsertSchema = shippingAddressSchema.extend({
  label: z.string().max(40).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const addressUpdateSchema = addressUpsertSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
);

export const shippingQuoteSchema = z.object({
  country: z.string().min(2).max(2),
  currency: currencySchema.optional(),
  shippingMethodId: z.string().min(1).optional(),
});

export const checkoutCreateSchema = z
  .object({
    cartId: z.string().min(1),
    currency: currencySchema,
    locale: localeSchema.optional().default('en'),
    shippingAddress: shippingAddressSchema.optional(),
    /** Reuse a saved address book entry (authenticated customers). */
    addressId: z.string().min(1).optional(),
    shippingMethodId: z.string().min(1),
    /** Required for guest checkout (contact phone). */
    phone: z.string().min(6).max(40).optional(),
    /** Optional guest email for order confirmation / transactional mail. */
    email: z
      .union([z.string().email(), z.literal('')])
      .optional()
      .nullable()
      .transform((v) => (v === '' || v == null ? undefined : v.toLowerCase())),
    /** Guests always COD; authenticated customers may choose CARD or COD. */
    paymentMethod: z.enum(['CARD', 'COD']).optional(),
    /** Persist shipping address to the customer address book after place-order. */
    saveAddress: z.boolean().optional(),
    addressLabel: z.string().max(40).optional().nullable(),
    /** Client-generated key (also accepted via Idempotency-Key header). */
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((data) => Boolean(data.shippingAddress || data.addressId), {
    message: 'shippingAddress or addressId is required',
    path: ['shippingAddress'],
  });

export const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1).optional(),
  paymentRef: z.string().min(1).optional(),
});

const orderStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

export const orderAdminListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const orderStatusUpdateSchema = z.object({
  status: orderStatusSchema,
  note: z.string().max(500).optional().nullable(),
});

export const orderCancelSchema = z.object({
  note: z.string().max(500).optional().nullable(),
});

export const guestOrderTrackSchema = z.object({
  orderNumber: z.string().trim().min(1).max(64),
  token: z.string().trim().min(16).max(128),
});

export const orderRefundSchema = z.object({
  note: z.string().max(500).optional().nullable(),
  /** When true (default), also cancel PENDING/PROCESSING orders after refund. */
  cancelOrder: z.boolean().optional().default(true),
});

export const journalArticleTranslationSchema = z.object({
  locale: localeSchema,
  title: z.string().min(1),
  excerpt: z.string().optional().nullable(),
  body: z.string().min(1),
});

export const journalArticleUpsertSchema = z
  .object({
    slug: slugSchema.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    publishedAt: z.coerce.date().optional().nullable(),
    coverMediaId: z.string().optional().nullable(),
    galleryMediaIds: z.array(z.string().min(1)).max(24).optional(),
    recommendedProductIds: z.array(z.string().min(1)).max(24).optional(),
    translations: z.array(journalArticleTranslationSchema).min(1),
  })
  .superRefine((val, ctx) => {
    requireEnglishTranslation(val.translations, ctx);
  });

export const journalListQuerySchema = z.object({
  locale: localeSchema.optional().default('en'),
  currency: currencySchema.optional().default('USD'),
  market: marketCodeSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(48).optional().default(12),
});

export const promoBannerTranslationSchema = z.object({
  locale: localeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
  ctaLabel: z.string().optional().nullable(),
});

export const promoBannerUpsertSchema = z
  .object({
    placement: z.enum(['HOME_HERO', 'HOME_SECONDARY']),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    href: z.string().optional().nullable(),
    imageMediaId: z.string().optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    translations: z.array(promoBannerTranslationSchema).min(1),
  })
  .superRefine((val, ctx) => {
    requireEnglishTranslation(val.translations, ctx);
  });

export const bannersQuerySchema = z.object({
  placement: z.enum(['HOME_HERO', 'HOME_SECONDARY']),
  locale: localeSchema.optional().default('en'),
  currency: currencySchema.optional(),
  market: marketCodeSchema.optional(),
});

export const marketUpdateSchema = z.object({
  enabled: z.boolean(),
});

export type MarketUpdateInput = z.infer<typeof marketUpdateSchema>;

export const storeSettingsUpdateSchema = z.object({
  taxRateBps: z.number().int().nonnegative().max(10000).optional(),
  freeShippingEnabled: z.boolean().optional(),
  freeShippingThreshold: z.number().int().nonnegative().optional(),
  domesticShipping: z.number().int().nonnegative().optional(),
  internationalShipping: z.number().int().nonnegative().optional(),
  domesticCountries: z.string().min(2).optional(),
  cashOnDeliveryEnabled: z.boolean().optional(),
  cardPaymentEnabled: z.boolean().optional(),
  stripeEnabled: z.boolean().optional(),
  /** Omit or empty = keep existing; set a value to replace. */
  stripeSecretKey: z.string().optional().nullable(),
  stripePublishableKey: z.string().optional().nullable(),
  konnectEnabled: z.boolean().optional(),
  konnectApiKey: z.string().optional().nullable(),
  konnectWalletId: z.string().optional().nullable(),
  konnectSandbox: z.boolean().optional(),
  contactWhatsapp: z.string().max(500).optional().nullable(),
  contactFacebook: z.string().max(500).optional().nullable(),
  contactInstagram: z.string().max(500).optional().nullable(),
  contactPhone: z.string().max(80).optional().nullable(),
  contactEmail: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  lowStockThreshold: z.number().int().nonnegative().max(100).optional(),
  loyaltyEnabled: z.boolean().optional(),
  loyaltyPointsPerMajorUnit: z.number().int().nonnegative().max(10_000).optional(),
  loyaltyPointValueMinor: z.number().int().positive().max(100_000).optional(),
  loyaltyMinOrderMinor: z.number().int().nonnegative().max(100_000_000).optional().nullable(),
  loyaltyMaxRedeemBps: z.number().int().positive().max(10_000).optional().nullable(),
  loyaltySignupBonusPoints: z.number().int().nonnegative().max(1_000_000).optional(),
  shippingMethods: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(80),
        description: z.string().max(240).optional().nullable(),
        price: z.number().int().nonnegative(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
        eligibleForFreeShipping: z.boolean().optional(),
        estimatedDaysMin: z.number().int().positive().optional().nullable(),
        estimatedDaysMax: z.number().int().positive().optional().nullable(),
      }),
    )
    .optional(),
});

export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>;
export type BrandUpsertInput = z.infer<typeof brandUpsertSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductBulkTagsInput = z.infer<typeof productBulkTagsSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductAdminListQuery = z.infer<typeof productAdminListQuerySchema>;
export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>;
export type InventoryTransferInput = z.infer<typeof inventoryTransferSchema>;
export type WarehouseUpsertInput = z.infer<typeof warehouseUpsertSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;
export type CartAddItemInput = z.infer<typeof cartAddItemSchema>;
export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;
export type AddressUpsertInput = z.infer<typeof addressUpsertSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
export type StoreSettingsUpdateInput = z.infer<typeof storeSettingsUpdateSchema>;
export type OrderAdminListQuery = z.infer<typeof orderAdminListQuerySchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderCancelInput = z.infer<typeof orderCancelSchema>;
export type GuestOrderTrackInput = z.infer<typeof guestOrderTrackSchema>;
export type OrderRefundInput = z.infer<typeof orderRefundSchema>;
export type JournalArticleUpsertInput = z.infer<typeof journalArticleUpsertSchema>;
export type JournalListQuery = z.infer<typeof journalListQuerySchema>;
export type PromoBannerUpsertInput = z.infer<typeof promoBannerUpsertSchema>;
export type BannersQuery = z.infer<typeof bannersQuerySchema>;

export const reviewUpsertSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  body: z.string().min(10).max(2000),
});

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(50).optional().default(10),
});

export const reviewModerationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const adminReviewListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

export const customerProfileUpdateSchema = z.object({
  firstName: z.string().min(1).max(80).optional().nullable(),
  lastName: z.string().min(1).max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  preferredLocale: localeSchema.optional().nullable(),
  preferredCurrency: currencySchema.optional().nullable(),
});

export const adminCustomerListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).optional().default(30),
  currency: currencySchema.optional(),
  market: marketCodeSchema.optional(),
  topLimit: z.coerce.number().int().positive().max(50).optional().default(10),
  lowStockThreshold: z.coerce.number().int().nonnegative().max(100).optional().default(5),
});

export type ReviewUpsertInput = z.infer<typeof reviewUpsertSchema>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;
export type CustomerProfileUpdateInput = z.infer<typeof customerProfileUpdateSchema>;
export type AdminCustomerListQuery = z.infer<typeof adminCustomerListQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const couponUpsertSchema = z
  .object({
    code: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric (dashes/underscores ok)'),
    type: z.enum(['PERCENT', 'FIXED']),
    description: z.string().max(240).optional().nullable(),
    percentOff: z.number().int().min(1).max(100).optional().nullable(),
    amountOff: z.number().int().nonnegative().optional().nullable(),
    minSubtotal: z.number().int().nonnegative().optional().nullable(),
    maxUses: z.number().int().positive().optional().nullable(),
    maxUsesPerCustomer: z.number().int().positive().optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
    productScope: z.enum(['ALL', 'INCLUDE', 'EXCLUDE']).optional(),
    productTags: z.array(z.string().min(1).max(40)).max(24).optional(),
    productIds: z.array(z.string().min(1)).max(100).optional(),
    ruleIsNew: z.boolean().optional(),
    ruleMinPriceUsd: z.number().int().nonnegative().optional().nullable(),
    ruleMinRating: z.number().min(0).max(5).optional().nullable(),
    marketCode: marketCodeSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'PERCENT') {
      if (val.percentOff == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'percentOff is required for PERCENT coupons',
          path: ['percentOff'],
        });
      }
    } else if (val.amountOff == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'amountOff is required for FIXED coupons',
        path: ['amountOff'],
      });
    }
    if (val.startsAt && val.endsAt && val.endsAt < val.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      });
    }
  });

export const wishlistAddSchema = z.object({
  productId: z.string().min(1),
});

export const homeRailsQuerySchema = z.object({
  currency: currencySchema.optional().default('USD'),
  locale: localeSchema.optional().default('en'),
  limit: z.coerce.number().int().positive().max(24).optional().default(8),
});

export const behaviorEventSchema = z.object({
  type: z.enum(['SEARCH', 'PRODUCT_CLICK']),
  productId: z.string().min(1).optional().nullable(),
  query: z.string().max(200).optional().nullable(),
  locale: localeSchema.optional().nullable(),
  /** Visitor currency cookie → AE/TN/OTHER for search insights. */
  currency: currencySchema.optional().nullable(),
  path: z.string().max(500).optional().nullable(),
  sessionId: z.string().max(80).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
});

export const behaviorBatchSchema = z.object({
  events: z.array(behaviorEventSchema).min(1).max(100),
  /** Default currency when individual events omit it. */
  currency: currencySchema.optional(),
});

export const merchandisingRailKindSchema = z.enum(['TOP', 'NEW', 'INCOMING', 'TOP_PACKS']);

export const merchandisingRailReplaceSchema = z.object({
  productIds: z.array(z.string().min(1)).max(24),
});

export type CartApplyCouponInput = z.infer<typeof cartApplyCouponSchema>;
export type CartApplyLoyaltyInput = z.infer<typeof cartApplyLoyaltySchema>;
export const promotionUpsertSchema = z
  .object({
    name: z.string().min(1).max(120),
    slug: z.preprocess((v) => {
      if (v == null || v === '') return undefined;
      if (typeof v !== 'string') return v;
      const normalized = v
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return normalized || undefined;
    }, slugSchema.optional()),
    tag: z.string().min(1).max(40),
    description: z.string().max(2000).optional().nullable(),
    startsAt: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.date().optional().nullable(),
    ),
    endsAt: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.coerce.date().optional().nullable(),
    ),
    isActive: z.boolean().optional(),
    productIds: z.array(z.string().min(1)).optional().default([]),
  })
  .superRefine((val, ctx) => {
    if (val.startsAt && val.endsAt && val.endsAt < val.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      });
    }
  });

export const stockNotifySubscribeSchema = z.object({
  email: z.string().email().optional(),
  productId: z.string().min(1),
  variantId: z.string().min(1).optional().nullable(),
  locale: z.enum(['en', 'ar', 'fr']).optional(),
});

export const stockNotifyAdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['pending', 'notified', 'all']).optional().default('pending'),
  q: z.string().optional(),
});

/** Admin-triggered marketing send via Amazon SES (not a full ESP). */
export const marketingSendSchema = z
  .object({
    to: z
      .union([
        z.string().email(),
        z.array(z.string().email()).min(1).max(50),
      ])
      .optional(),
    audience: z.enum(['explicit', 'newsletter']).optional().default('explicit'),
    locale: z.enum(['en', 'ar', 'fr']).optional(),
    dryRun: z.boolean().optional().default(false),
    subject: z.string().min(1).max(200),
    previewText: z.string().max(200).optional(),
    bodyHtml: z.string().min(1).max(50_000),
    bodyText: z.string().min(1).max(50_000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audience === 'explicit') {
      const recipients = data.to
        ? Array.isArray(data.to)
          ? data.to
          : [data.to]
        : [];
      if (!recipients.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one recipient is required for explicit audience',
          path: ['to'],
        });
      }
    }
  });

export const newsletterSubscribeSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'ar', 'fr']).optional(),
  source: z.string().max(64).optional(),
});

export const newsletterUnsubscribeSchema = z.object({
  email: z.string().email(),
  token: z.string().min(16).max(128),
});

export const emailLogAdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['SENT', 'FAILED', 'SKIPPED', 'all']).optional().default('all'),
  templateType: z.string().optional(),
  q: z.string().optional(),
});

export const newsletterAdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['SUBSCRIBED', 'UNSUBSCRIBED', 'all']).optional().default('SUBSCRIBED'),
  locale: z.enum(['en', 'ar', 'fr', 'all']).optional().default('all'),
  q: z.string().optional(),
});

export type CouponUpsertInput = z.infer<typeof couponUpsertSchema>;
export type WishlistAddInput = z.infer<typeof wishlistAddSchema>;
export type HomeRailsQuery = z.infer<typeof homeRailsQuerySchema>;
export type BehaviorBatchInput = z.infer<typeof behaviorBatchSchema>;
export type MerchandisingRailReplaceInput = z.infer<typeof merchandisingRailReplaceSchema>;
export type PromotionUpsertInput = z.infer<typeof promotionUpsertSchema>;
export type StockNotifySubscribeInput = z.infer<typeof stockNotifySubscribeSchema>;
export type StockNotifyAdminListQuery = z.infer<typeof stockNotifyAdminListQuerySchema>;
export type MarketingSendInput = z.infer<typeof marketingSendSchema>;
export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
export type NewsletterUnsubscribeInput = z.infer<typeof newsletterUnsubscribeSchema>;
export type EmailLogAdminListQuery = z.infer<typeof emailLogAdminListQuerySchema>;
export type NewsletterAdminListQuery = z.infer<typeof newsletterAdminListQuerySchema>;

export { z };
