import { Global, Module } from '@nestjs/common';
import { EmailLogService } from './email-log.service';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { OrderMailHelper } from './order-mail.helper';
import { SesMailService } from './ses-mail.service';

@Global()
@Module({
  controllers: [NewsletterController],
  providers: [SesMailService, OrderMailHelper, NewsletterService, EmailLogService],
  exports: [SesMailService, OrderMailHelper, NewsletterService, EmailLogService],
})
export class MailModule {}
