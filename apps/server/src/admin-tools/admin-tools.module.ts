import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketsModule } from '../markets/markets.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminHelpController } from './admin-help.controller';
import { AdminHelpService } from './admin-help.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { MailModule } from '../mail/mail.module';
import { AdminProductivityController } from './admin-productivity.controller';
import { AdminProductivityService } from './admin-productivity.service';

@Module({
  imports: [AuthModule, MarketsModule, PrismaModule, MailModule],
  controllers: [AdminHelpController, AdminNotificationsController, AdminProductivityController],
  providers: [AdminHelpService, AdminNotificationsService, AdminProductivityService],
  exports: [AdminHelpService, AdminNotificationsService, AdminProductivityService],
})
export class AdminToolsModule {}
