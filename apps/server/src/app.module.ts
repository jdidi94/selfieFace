import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BehaviorModule } from './behavior/behavior.module';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { CommerceModule } from './commerce/commerce.module';
import { ContentModule } from './content/content.module';
import { CustomersModule } from './customers/customers.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CacheModule } from './common/cache/cache.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { MarketsModule } from './markets/markets.module';
import { MediaModule } from './media/media.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { MerchandisingModule } from './merchandising/merchandising.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    MailModule,
    HealthModule,
    AuthModule,
    AdminModule,
    MarketsModule,
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    InventoryModule,
    MediaModule,
    CommerceModule,
    ContentModule,
    ReviewsModule,
    CustomersModule,
    AnalyticsModule,
    MerchandisingModule,
    BehaviorModule,
    LoyaltyModule,
    SupportModule,
  ],
})
export class AppModule {}

