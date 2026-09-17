import { Body, Controller, Post } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() body: unknown) {
    return this.newsletter.subscribe(body);
  }

  @Post('unsubscribe')
  unsubscribe(@Body() body: unknown) {
    return this.newsletter.unsubscribe(body);
  }
}
