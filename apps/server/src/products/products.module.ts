import { Module } from '@nestjs/common';
import { MarketsModule } from '../markets/markets.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminProductsController } from './admin-products.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [ReviewsModule, MarketsModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
