import { Body, Controller, Post } from '@nestjs/common';
import { MailRecipientsService } from './mail-recipients.service';

@Controller('mail/recipients')
export class VerifyMailRecipientController {
  constructor(private readonly recipients: MailRecipientsService) {}

  @Post('verify')
  verify(@Body('token') token = '') {
    return this.recipients.verify(String(token));
  }
}
