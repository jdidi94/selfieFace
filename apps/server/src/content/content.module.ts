import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketsModule } from '../markets/markets.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminBannersController } from './admin-banners.controller';
import { AdminFaqController } from './admin-faq.controller';
import { AdminJournalController } from './admin-journal.controller';
import { AdminLegalDocumentsController } from './admin-legal-documents.controller';
import { BannersService } from './banners.service';
import { ContentController } from './content.controller';
import { FaqService } from './faq.service';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { LegalDocumentsService } from './legal-documents.service';

@Module({
  imports: [AuthModule, ReviewsModule, MarketsModule],
  controllers: [
    JournalController,
    ContentController,
    AdminJournalController,
    AdminBannersController,
    AdminFaqController,
    AdminLegalDocumentsController,
  ],
  providers: [JournalService, BannersService, FaqService, LegalDocumentsService],
})
export class ContentModule {}
