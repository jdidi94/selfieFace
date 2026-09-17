import { Controller, Get, Query } from '@nestjs/common';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { MerchandisingService } from './merchandising.service';

@Controller('merchandising')
export class MerchandisingController {
  constructor(private readonly merchandisingService: MerchandisingService) {}

  @Get('rails')
  @HttpCache(300)
  rails(@Query() query: Record<string, string>) {
    return this.merchandisingService.listHomeRails(query);
  }
}
