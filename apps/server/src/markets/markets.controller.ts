import { Controller, Get, Query } from '@nestjs/common';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { MarketsService } from './markets.service';

@Controller()
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get('markets')
  @HttpCache(60)
  list() {
    return this.marketsService.list();
  }

  @Get('store/market')
  @HttpCache(60)
  byCurrency(@Query('currency') currency?: string) {
    return this.marketsService.resolveFromCurrency(currency);
  }
}
