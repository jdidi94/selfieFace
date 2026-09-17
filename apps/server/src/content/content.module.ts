import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketsModule } from '../markets/markets.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminBannersController } from './admin-banners.controller';
import { AdminJournalController } from './admin-journal.controller';
import { BannersService } from './banners.service';
import { ContentController } from './content.controller';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

@Module({
  imports: [AuthModule, ReviewsModule, MarketsModule],
  controllers: [
    JournalController,
    ContentController,
    AdminJournalController,
    AdminBannersController,
  ],
  providers: [JournalService, BannersService],
})
export class ContentModule {}
