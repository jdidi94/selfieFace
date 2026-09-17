import { Controller, Get, Param, Query } from '@nestjs/common';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @HttpCache(300)
  list(@Query() query: Record<string, string>) {
    return this.productsService.listPublic(query);
  }

  @Get('catalog/price-range')
  @HttpCache(300)
  priceRange(@Query() query: Record<string, string>) {
    return this.productsService.getPublicPriceRange(query);
  }

  @Get(':slug/related')
  @HttpCache(300)
  related(
    @Param('slug') slug: string,
    @Query('currency') currency?: string,
    @Query('locale') locale?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.listRelated(
      slug,
      currency ?? 'USD',
      locale ?? 'en',
      limit ? Number(limit) : 4,
    );
  }

  @Get(':slug')
  @HttpCache(300)
  bySlug(
    @Param('slug') slug: string,
    @Query('currency') currency?: string,
    @Query('locale') locale?: string,
  ) {
    return this.productsService.getBySlug(slug, currency ?? 'USD', locale ?? 'en');
  }
}
