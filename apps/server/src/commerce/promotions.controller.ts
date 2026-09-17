import { Controller, Get, Query } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('products')
  listProducts(@Query() query: Record<string, string>) {
    const currency = query.currency ?? 'USD';
    const locale = query.locale ?? 'en';
    const limit = Number(query.limit ?? '12') || 12;
    return this.promotionsService.listActiveProducts(currency, locale, limit);
  }
}
