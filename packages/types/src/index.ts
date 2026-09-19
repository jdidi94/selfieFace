export enum UserType {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EDITOR = 'EDITOR',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ProductKind {
  PRODUCT = 'PRODUCT',
  PACK = 'PACK',
}

export enum InventoryReason {
  SALE = 'SALE',
  RESTOCK = 'RESTOCK',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  TRANSFER = 'TRANSFER',
}

export enum Currency {
  USD = 'USD',
  TND = 'TND',
  AED = 'AED',
}

/** Commercial window: Emirates / Tunisia / rest of world. */
export enum MarketCode {
  AE = 'AE',
  TN = 'TN',
  OTHER = 'OTHER',
}

export enum Locale {
  EN = 'en',
  AR = 'ar',
  FR = 'fr',
}

export const SUPPORTED_CURRENCIES = [Currency.USD, Currency.TND, Currency.AED] as const;

export const SUPPORTED_MARKET_CODES = [MarketCode.AE, MarketCode.TN, MarketCode.OTHER] as const;

export const SUPPORTED_LOCALES = [Locale.EN, Locale.AR, Locale.FR] as const;

/** Cookie / cart currency → market window. */
export const MARKET_BY_CURRENCY: Record<Currency, MarketCode> = {
  [Currency.AED]: MarketCode.AE,
  [Currency.TND]: MarketCode.TN,
  [Currency.USD]: MarketCode.OTHER,
};

export const CURRENCY_BY_MARKET: Record<MarketCode, Currency> = {
  [MarketCode.AE]: Currency.AED,
  [MarketCode.TN]: Currency.TND,
  [MarketCode.OTHER]: Currency.USD,
};

export type MarketDto = {
  id: string;
  code: MarketCode;
  name: string;
  currency: Currency;
  enabled: boolean;
};

export type CategoryTranslationDto = {
  locale: Locale;
  name: string;
  description?: string | null;
};

export type BrandTranslationDto = {
  locale: Locale;
  name: string;
  description?: string | null;
};

export type ProductTranslationDto = {
  locale: Locale;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  benefits?: string | null;
  howToUse?: string | null;
  suitableFor?: string | null;
};

export type Permission =
  | 'products.read'
  | 'products.create'
  | 'products.update'
  | 'products.delete'
  | 'orders.read'
  | 'orders.update'
  | 'customers.read'
  | 'inventory.read'
  | 'inventory.update'
  | 'content.read'
  | 'content.create'
  | 'content.update'
  | 'analytics.read'
  | 'coupons.read'
  | 'coupons.create'
  | 'coupons.update'
  | 'coupons.delete';

export type AuthUser = {
  id: string;
  email: string;
  type: UserType;
  adminRole?: AdminRole | null;
  firstName?: string | null;
  lastName?: string | null;
  /** False until the customer confirms email (Google OAuth counts as verified). */
  emailVerified: boolean;
  permissions?: Permission[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type HealthStatus = {
  status: 'ok' | 'degraded' | 'error';
  database: 'up' | 'down';
  timestamp: string;
  version?: string;
};

export type ApiErrorBody = {
  statusCode: number;
  /** Always a single human-readable summary string from the API filter. */
  message: string;
  /** Field-level messages keyed by human labels (e.g. "Start date"). */
  fieldErrors?: Record<string, string[]>;
  error: string;
  path?: string;
  timestamp: string;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  locale?: Locale;
  translations?: CategoryTranslationDto[];
};

export type CatalogBrand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  locale?: Locale;
  translations?: BrandTranslationDto[];
};

export type VariantPriceDto = {
  currency: Currency;
  amount: number;
  compareAtAmount?: number | null;
};

export type ProductVariantDto = {
  id: string;
  name: string;
  sku: string;
  /** Amount in the requested display currency */
  price: number;
  compareAtPrice?: number | null;
  currency: Currency;
  prices: VariantPriceDto[];
  stock: number;
  weightGrams?: number | null;
  barcode?: string | null;
  isActive: boolean;
};

export type ProductImageDto = {
  id: string;
  mediaId: string;
  url: string;
  alt?: string | null;
  sortOrder: number;
};

export type ProductRatingSummary = {
  averageRating: number;
  reviewCount: number;
};

export type ProductLabelKind = 'incoming' | 'promotion' | 'top_rated' | 'out_of_stock';

export type ProductLabelDto = {
  kind: ProductLabelKind;
  /** Campaign badge copy when kind = promotion; otherwise client i18n */
  tag?: string | null;
};

export type PackComponentDto = {
  id: string;
  variantId: string;
  quantity: number;
  sortOrder: number;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  variantSku: string;
  unitPrice: number;
  linePrice: number;
  currency: Currency;
  stock: number;
  imageUrl?: string | null;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  kind?: ProductKind;
  marketCode?: MarketCode;
  shortDescription?: string | null;
  category: CatalogCategory;
  brand: CatalogBrand;
  priceFrom: number;
  compareAtFrom?: number | null;
  /** Sum of component prices when kind=PACK (for savings compare). */
  packCompareAtFrom?: number | null;
  currency: Currency;
  locale?: Locale;
  imageUrl?: string | null;
  inStock: boolean;
  isIncoming?: boolean;
  isPromotion?: boolean;
  isTopRated?: boolean;
  tags?: string[];
  /** First active in-stock variant for card add-to-bag */
  defaultVariantId?: string | null;
  labels?: ProductLabelDto[];
  averageRating?: number | null;
  reviewCount?: number;
  packItemCount?: number;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  kind?: ProductKind;
  marketCode?: MarketCode;
  shortDescription?: string | null;
  description?: string | null;
  benefits?: string | null;
  howToUse?: string | null;
  suitableFor?: string | null;
  category: CatalogCategory;
  brand: CatalogBrand;
  currency: Currency;
  locale?: Locale;
  translations?: ProductTranslationDto[];
  variants: ProductVariantDto[];
  images: ProductImageDto[];
  isIncoming?: boolean;
  incomingAt?: string | null;
  popularityScore?: number;
  isPromotion?: boolean;
  isTopRated?: boolean;
  tags?: string[];
  labels?: ProductLabelDto[];
  defaultVariantId?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  packComponents?: PackComponentDto[];
  packCompareAtFrom?: number | null;
  packSavings?: number | null;
};

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type ProductReviewDto = {
  id: string;
  rating: number;
  title?: string | null;
  body: string;
  status: ReviewStatus;
  createdAt: string;
  authorName: string;
};

export type ProductReviewListResponse = {
  items: ProductReviewDto[];
  total: number;
  page: number;
  pageSize: number;
  summary: ProductRatingSummary;
};

export type CustomerProfileDto = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  preferredLocale?: Locale | null;
  preferredCurrency?: Currency | null;
  loyaltyBalance?: number | null;
};

export type AddressDto = {
  id: string;
  label?: string | null;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomerListItemDto = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  orderCount: number;
  loyaltyBalance?: number | null;
  createdAt: string;
};

export type AdminCustomerListResponse = {
  items: AdminCustomerListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminReviewListItemDto = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  customerEmail: string;
  rating: number;
  title?: string | null;
  body: string;
  status: ReviewStatus;
  createdAt: string;
};

export type AdminReviewListResponse = {
  items: AdminReviewListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductListResponse = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  currency: Currency;
  locale?: Locale;
};

export type ProductListFilters = {
  q?: string;
  category?: string;
  brand?: string;
  currency?: Currency;
  locale?: Locale;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  recommended?: boolean;
  incoming?: boolean;
  promotion?: boolean;
  page?: number;
  pageSize?: number;
};

export type PromotionDto = {
  id: string;
  name: string;
  slug: string;
  tag: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  marketCode?: MarketCode;
  productIds: string[];
  createdAt: string;
  updatedAt: string;
};

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  COD = 'COD',
  STRIPE = 'STRIPE',
  KONNECT = 'KONNECT',
}

export enum ShippingZone {
  DOMESTIC = 'DOMESTIC',
  INTERNATIONAL = 'INTERNATIONAL',
}

export type CartItemDto = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stock: number;
  imageUrl?: string | null;
};

export type CartCouponDto = {
  id: string;
  code: string;
  type: CouponType;
  percentOff?: number | null;
};

export type CartStockAdjustmentDto = {
  itemId: string;
  productName: string;
  previousQuantity: number;
  quantity: number;
  removed: boolean;
};

export type CartDto = {
  id: string;
  currency: Currency;
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  coupon?: CartCouponDto | null;
  /** Coupon portion of `discount` (loyalty is separate). */
  couponDiscount?: number;
  /** Loyalty redeem state when program is enabled and customer is signed in. */
  loyalty?: CartLoyaltyDto | null;
  items: CartItemDto[];
  /** Free-shipping threshold in minor units for the cart currency (0 = disabled). */
  freeShippingThreshold: number;
  /** Amount still needed (after discount) to unlock free shipping. */
  amountUntilFreeShipping: number;
  /** Present when GET/mutations clamped or removed lines due to stock. */
  stockAdjustments?: CartStockAdjustmentDto[];
};

export type CartLoyaltyDto = {
  enabled: boolean;
  balance: number;
  pointsToRedeem: number;
  discount: number;
  pointValueMinor: number;
  pointsPerMajorUnit: number;
  minOrderMinor: number | null;
  maxRedeemBps: number | null;
};

export enum CouponType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum CouponProductScope {
  ALL = 'ALL',
  INCLUDE = 'INCLUDE',
  EXCLUDE = 'EXCLUDE',
}

export type CouponDto = {
  id: string;
  code: string;
  type: CouponType;
  marketCode?: MarketCode;
  /** Customer-facing blurb for the storefront coupons bar. */
  description?: string | null;
  percentOff?: number | null;
  /** Fixed amount off in minor units of the coupon market currency. */
  amountOff?: number | null;
  /** Minimum subtotal in minor units of the coupon market currency. */
  minSubtotal?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  usedCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  productScope: CouponProductScope;
  productTags: string[];
  productIds: string[];
  ruleIsNew: boolean;
  ruleMinPriceUsd?: number | null;
  ruleMinRating?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type WishlistItemDto = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl?: string | null;
  priceFrom: number;
  compareAtFrom?: number | null;
  currency: Currency;
  inStock: boolean;
  createdAt: string;
};

export type ShippingMethodDto = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  /** Minor units in the market currency. */
  price: number;
  sortOrder: number;
  isActive: boolean;
  eligibleForFreeShipping: boolean;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
};

export type ShippingMethodQuoteDto = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amount: number;
  baseAmount: number;
  freeShippingApplied: boolean;
  eligibleForFreeShipping: boolean;
  currency: Currency;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
};

export type ShippingQuoteDto = {
  zone: ShippingZone;
  amount: number;
  currency: Currency;
  freeShippingApplied: boolean;
  methodId?: string | null;
  methodCode?: string | null;
  methodName?: string | null;
};

export type CheckoutTotalsDto = {
  currency: Currency;
  subtotal: number;
  discount: number;
  shippingAmount: number;
  taxAmount: number;
  total: number;
  shipping: ShippingQuoteDto;
  shippingMethods: ShippingMethodQuoteDto[];
  freeShippingThreshold: number;
  amountUntilFreeShipping: number;
  coupon?: CartCouponDto | null;
};

export type OrderItemAllocationDto = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
};

export type OrderItemDto = {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** Warehouses that fulfilled this line (admin/detail); omitted when none recorded. */
  allocations?: OrderItemAllocationDto[];
};

export type WarehouseDto = {
  id: string;
  name: string;
  code: string;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isActive: boolean;
  isDefault: boolean;
  marketId: string;
  marketCode?: MarketCode;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseStockDto = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  isDefault: boolean;
  isActive: boolean;
  quantity: number;
};

export type InventoryRowDto = {
  id: string;
  sku: string;
  name: string;
  /** Aggregate across active warehouses. */
  stock: number;
  isActive: boolean;
  product: { id: string; name: string; slug: string };
  warehouses: WarehouseStockDto[];
};

export type InventoryListResponse = {
  items: InventoryRowDto[];
  lowStockThreshold: number;
  warehouses: WarehouseDto[];
};

export enum OrderTimelineActorType {
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export type OrderTimelineEventDto = {
  id: string;
  status: OrderStatus;
  note?: string | null;
  actorType: OrderTimelineActorType;
  createdAt: string;
};

export type OrderCustomerSummaryDto = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type OrderDto = {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: Currency;
  locale?: Locale;
  marketCode?: MarketCode;
  subtotal: number;
  discount: number;
  shippingAmount: number;
  taxAmount: number;
  total: number;
  couponCode?: string | null;
  loyaltyPointsRedeemed?: number;
  loyaltyPointsEarned?: number;
  shippingZone: ShippingZone;
  shippingMethodId?: string | null;
  shippingMethodCode?: string | null;
  shippingMethodName?: string | null;
  shippingFullName: string;
  shippingLine1: string;
  shippingLine2?: string | null;
  shippingCity: string;
  shippingRegion?: string | null;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone?: string | null;
  items: OrderItemDto[];
  createdAt: string;
  clientSecret?: string | null;
  /** One-time browser token for guest order payment / confirmation (not persisted for account orders). */
  guestAccessToken?: string | null;
  timeline?: OrderTimelineEventDto[];
  stripeRefundId?: string | null;
  refundedAt?: string | null;
  refundAmount?: number | null;
  /** True when customer can cancel (pending unpaid / COD reserved). */
  canCancel?: boolean;
  /** True when admin can issue a refund (captured, not yet refunded). */
  canRefund?: boolean;
  paymentProvider?: PaymentProvider | string | null;
  /** Konnect hosted checkout URL (returned once at create). */
  payUrl?: string | null;
  konnectPaymentRef?: string | null;
};

export type AdminOrderDto = OrderDto & {
  customer: OrderCustomerSummaryDto;
};

export type OrderListItemDto = {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: Currency;
  marketCode?: MarketCode;
  total: number;
  createdAt: string;
  customerEmail?: string;
};

export type OrderListResponse = {
  items: OrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type PaymentOptionsDto = {
  cashEnabled: boolean;
  cardEnabled: boolean;
  taxRateBps: number;
  /** Card gateway for the selected currency (USD/AED → Stripe, else Konnect). */
  cardProvider: PaymentProvider.STRIPE | PaymentProvider.KONNECT | null;
  stripePublishableKey?: string | null;
  stripeConfigured: boolean;
  konnectConfigured: boolean;
};

export type StoreSettingsDto = {
  id: string;
  marketId: string;
  marketCode: MarketCode;
  taxRateBps: number;
  /** When false, free shipping is off for this market window. */
  freeShippingEnabled: boolean;
  /** Threshold in minor units of the market currency. */
  freeShippingThreshold: number;
  domesticShipping: number;
  internationalShipping: number;
  domesticCountries: string;
  shippingMethods: ShippingMethodDto[];
  cashOnDeliveryEnabled: boolean;
  cardPaymentEnabled: boolean;
  stripeEnabled: boolean;
  /** Masked; never the full secret. */
  stripeSecretKeySet: boolean;
  stripePublishableKey?: string | null;
  konnectEnabled: boolean;
  konnectApiKeySet: boolean;
  konnectWalletId?: string | null;
  konnectSandbox: boolean;
  contactWhatsapp?: string | null;
  contactFacebook?: string | null;
  contactInstagram?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  /** Notify / badge when variant stock ≤ this value. */
  lowStockThreshold: number;
  /** Store-wide loyalty program toggle. */
  loyaltyEnabled: boolean;
  /** Points earned per 1.00 spent on merchandise (after discounts). */
  loyaltyPointsPerMajorUnit: number;
  /** Discount value of 1 point in minor units. */
  loyaltyPointValueMinor: number;
  loyaltyMinOrderMinor?: number | null;
  /** Max redeem as % of post-coupon subtotal in basis points. */
  loyaltyMaxRedeemBps?: number | null;
  loyaltySignupBonusPoints: number;
};

export type StoreContactDto = {
  whatsapp?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  phone?: string | null;
  email?: string | null;
  /** When variant stock is ≤ this value (and > 0), storefront shows “limited stock”. */
  lowStockThreshold?: number;
};

/** Public active coupon for the storefront promo bar. */
export type ActiveCouponDto = {
  code: string;
  description?: string | null;
  type: CouponType;
  percentOff?: number | null;
  amountOff?: number | null;
  minSubtotal?: number | null;
  endsAt?: string | null;
};

export enum JournalArticleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export enum PromoBannerPlacement {
  HOME_HERO = 'HOME_HERO',
  HOME_SECONDARY = 'HOME_SECONDARY',
}

export type JournalArticleTranslationDto = {
  locale: Locale;
  title: string;
  excerpt?: string | null;
  body: string;
};

export type JournalArticleImageDto = {
  id: string;
  mediaId: string;
  url: string;
  alt?: string | null;
  sortOrder: number;
};

export type JournalArticleListItem = {
  id: string;
  slug: string;
  status: JournalArticleStatus;
  title: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  publishedAt?: string | null;
  locale?: Locale;
  marketCode?: MarketCode;
};

export type JournalArticleDetail = JournalArticleListItem & {
  body: string;
  coverMediaId?: string | null;
  gallery?: JournalArticleImageDto[];
  /** Media IDs for admin upsert */
  galleryMediaIds?: string[];
  recommendedProducts?: ProductListItem[];
  /** Product IDs for admin upsert */
  recommendedProductIds?: string[];
  translations?: JournalArticleTranslationDto[];
};

export type JournalListResponse = {
  items: JournalArticleListItem[];
  total: number;
  page: number;
  pageSize: number;
  locale?: Locale;
};

export type PromoBannerTranslationDto = {
  locale: Locale;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
};

export type PromoBannerDto = {
  id: string;
  placement: PromoBannerPlacement;
  isActive: boolean;
  sortOrder: number;
  marketCode?: MarketCode;
  href?: string | null;
  imageMediaId?: string | null;
  imageUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  locale?: Locale;
  translations?: PromoBannerTranslationDto[];
};

/** Paid order revenue bucketed by market currency (integer minor units). */
export type AnalyticsRevenueByCurrency = {
  currency: Currency;
  revenue: number;
  orderCount: number;
};

export type AnalyticsOrdersByStatus = {
  status: OrderStatus;
  count: number;
};

export type AnalyticsDailyPoint = {
  date: string;
  currency: Currency;
  revenue: number;
  orderCount: number;
};

export type AnalyticsTopProduct = {
  productId: string;
  productName: string;
  productSlug: string;
  unitsSold: number;
  /** Line revenue in the filtered currency when `currency` query is set; otherwise 0. */
  revenue: number;
};

export type AnalyticsLowStockItem = {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  productSlug: string;
  stock: number;
};

export type AdminDashboardResponse = {
  days: number;
  from: string;
  to: string;
  marketCode?: MarketCode | null;
  revenueByCurrency: AnalyticsRevenueByCurrency[];
  orderCount: number;
  pendingFulfillmentCount: number;
  lowStockCount: number;
};

export type AdminAnalyticsResponse = {
  days: number;
  from: string;
  to: string;
  currency?: Currency | null;
  marketCode?: MarketCode | null;
  revenueByCurrency: AnalyticsRevenueByCurrency[];
  averageOrderValueByCurrency: AnalyticsRevenueByCurrency[];
  orderCount: number;
  cancelledCount: number;
  pendingFulfillmentCount: number;
  ordersByStatus: AnalyticsOrdersByStatus[];
  revenueByDay: AnalyticsDailyPoint[];
  topProducts: AnalyticsTopProduct[];
  lowStock: AnalyticsLowStockItem[];
};

export enum MerchandisingRailKind {
  TOP = 'TOP',
  NEW = 'NEW',
  INCOMING = 'INCOMING',
  TOP_PACKS = 'TOP_PACKS',
}

export enum BehaviorEventType {
  SEARCH = 'SEARCH',
  PRODUCT_CLICK = 'PRODUCT_CLICK',
}

export type HomeProductRails = {
  top: ProductListItem[];
  new: ProductListItem[];
  incoming: ProductListItem[];
  topPacks: ProductListItem[];
  currency: Currency;
  locale?: Locale;
};

export type BehaviorEventInput = {
  type: BehaviorEventType;
  productId?: string | null;
  query?: string | null;
  locale?: Locale | null;
  path?: string | null;
  sessionId?: string | null;
  occurredAt?: string | null;
};

export type BehaviorBatchResponse = {
  accepted: number;
};

export type MerchandisingRailItemDto = {
  id: string;
  rail: MerchandisingRailKind;
  productId: string;
  sortOrder: number;
  product: ProductListItem;
};

export type MerchandisingRailsAdminDto = {
  top: MerchandisingRailItemDto[];
  new: MerchandisingRailItemDto[];
  incoming: MerchandisingRailItemDto[];
  topPacks: MerchandisingRailItemDto[];
};

export type SearchInsightDto = {
  id: string;
  query: string;
  locale?: Locale | null;
  hitCount: number;
  lastSeenAt: string;
  marketCode?: MarketCode;
};

export type StockNotifySubscriptionDto = {
  id: string;
  email: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId?: string | null;
  variantName?: string | null;
  variantSku?: string | null;
  variantStock?: number | null;
  locale?: Locale | null;
  notifiedAt?: string | null;
  createdAt: string;
};

export type StockNotifyListResponse = {
  items: StockNotifySubscriptionDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type StockNotifySubscribeResponse = {
  ok: boolean;
  alreadySubscribed?: boolean;
};

export enum EmailLogStatus {
  SENT = 'SENT',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum EmailTemplateType {
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  RESTOCK = 'RESTOCK',
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ADMIN_ORDER_NOTIFY = 'ADMIN_ORDER_NOTIFY',
  ADMIN_LOW_STOCK = 'ADMIN_LOW_STOCK',
  MARKETING = 'MARKETING',
  NEWSLETTER_WELCOME = 'NEWSLETTER_WELCOME',
  RAW = 'RAW',
}

export type EmailLogDto = {
  id: string;
  to: string;
  subject: string;
  templateType: EmailTemplateType | string;
  status: EmailLogStatus | string;
  providerMessageId?: string | null;
  error?: string | null;
  userId?: string | null;
  orderId?: string | null;
  createdAt: string;
};

export type EmailLogListResponse = {
  items: EmailLogDto[];
  total: number;
  page: number;
  pageSize: number;
};

export enum NewsletterStatus {
  SUBSCRIBED = 'SUBSCRIBED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
}

export type NewsletterSubscriberDto = {
  id: string;
  email: string;
  locale?: Locale | null;
  status: NewsletterStatus | string;
  source?: string | null;
  subscribedAt: string;
  unsubscribedAt?: string | null;
  createdAt: string;
};

export type NewsletterListResponse = {
  items: NewsletterSubscriberDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type NewsletterSubscribeResponse = {
  ok: boolean;
  alreadySubscribed?: boolean;
};

export type NewsletterUnsubscribeResponse = {
  ok: boolean;
  alreadyUnsubscribed?: boolean;
};

export type MarketingSendResultDto = {
  ok: boolean;
  dryRun: boolean;
  sesConfigured: boolean;
  audience: 'explicit' | 'newsletter';
  recipientCount: number;
  sent: number;
  failed: number;
  skipped: number;
  previewRecipients?: string[];
  messageId?: string | null;
  skippedReason?: string | null;
};

export enum LoyaltyLedgerType {
  EARN_ORDER = 'EARN_ORDER',
  REDEEM_ORDER = 'REDEEM_ORDER',
  SIGNUP_BONUS = 'SIGNUP_BONUS',
  ADJUST = 'ADJUST',
  EARN_REVERSAL = 'EARN_REVERSAL',
  REDEEM_RESTORE = 'REDEEM_RESTORE',
}

/** Public / admin-safe loyalty rules (no secrets). */
export type LoyaltyConfigDto = {
  enabled: boolean;
  pointsPerMajorUnit: number;
  pointValueMinor: number;
  minOrderMinor: number | null;
  maxRedeemBps: number | null;
  signupBonusPoints: number;
};

export type LoyaltyLedgerEntryDto = {
  id: string;
  type: LoyaltyLedgerType;
  points: number;
  balanceAfter: number;
  orderId?: string | null;
  note?: string | null;
  createdAt: string;
};

export type LoyaltyAccountDto = {
  balance: number;
  config: LoyaltyConfigDto;
  ledger: LoyaltyLedgerEntryDto[];
};
