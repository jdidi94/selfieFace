import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { MarketsModule } from '../markets/markets.module';
import { MediaModule } from '../media/media.module';
import { AdminSupportTicketsController } from './admin-support-tickets.controller';
import { SupportController } from './support.controller';
import { SupportTicketsService } from './support-tickets.service';

@Module({
  imports: [AuthModule, MarketsModule, MediaModule],
  controllers: [SupportController, AdminSupportTicketsController],
  providers: [SupportTicketsService, RateLimitGuard],
})
export class SupportModule {}
