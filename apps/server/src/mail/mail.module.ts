import { Global, Module } from '@nestjs/common';
import { MarketsModule } from '../markets/markets.module';
import { EmailLogService } from './email-log.service';
import { MailRecipientsService } from './mail-recipients.service';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { OrderMailHelper } from './order-mail.helper';
import { SesMailService } from './ses-mail.service';
import { VerifyMailRecipientController } from './verify-mail-recipient.controller';

@Global()
@Module({
  imports: [MarketsModule],
  controllers: [NewsletterController, VerifyMailRecipientController],
  providers: [
    SesMailService,
    OrderMailHelper,
    NewsletterService,
    EmailLogService,
    MailRecipientsService,
  ],
  exports: [
    SesMailService,
    OrderMailHelper,
    NewsletterService,
    EmailLogService,
    MailRecipientsService,
  ],
})
export class MailModule {}
