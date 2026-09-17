import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketsModule } from '../markets/markets.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminMerchandisingController } from './admin-merchandising.controller';
import { MerchandisingController } from './merchandising.controller';
import { MerchandisingService } from './merchandising.service';

@Module({
  imports: [AuthModule, ReviewsModule, MarketsModule],
  controllers: [MerchandisingController, AdminMerchandisingController],
  providers: [MerchandisingService],
  exports: [MerchandisingService],
})
export class MerchandisingModule {}
