import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../common/cache/cache.module';
import { CustomersModule } from '../customers/customers.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { MarketsModule } from '../markets/markets.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminCouponsController } from './admin-coupons.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminPromotionsController } from './admin-promotions.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminStockNotifyController } from './admin-stock-notify.controller';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';
import { CommerceController } from './commerce.controller';
import { CouponsService } from './coupons.service';
import { KonnectService } from './konnect.service';
import { OrdersService } from './orders.service';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { StockNotifyController } from './stock-notify.controller';
import { StockNotifyService } from './stock-notify.service';
import { StoreSettingsService } from './store-settings.service';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    ReviewsModule,
    CustomersModule,
    LoyaltyModule,
    MarketsModule,
  ],
  controllers: [
    CommerceController,
    AdminSettingsController,
    AdminOrdersController,
    AdminCouponsController,
    AdminPromotionsController,
    AdminStockNotifyController,
    PromotionsController,
    WishlistController,
    StockNotifyController,
  ],
  providers: [
    CartService,
    CheckoutService,
    OrdersService,
    StoreSettingsService,
    CouponsService,
    PromotionsService,
    WishlistService,
    KonnectService,
    StockNotifyService,
  ],
  exports: [
    CartService,
    CheckoutService,
    OrdersService,
    StoreSettingsService,
    CouponsService,
    PromotionsService,
    WishlistService,
    KonnectService,
    StockNotifyService,
  ],
})
export class CommerceModule {}
