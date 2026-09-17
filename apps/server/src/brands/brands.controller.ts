import { Controller, Get, Query } from '@nestjs/common';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { BrandsService } from './brands.service';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @HttpCache(300)
  list(@Query('locale') locale?: string, @Query('currency') currency?: string) {
    return this.brandsService.listPublic(locale ?? 'en', currency);
  }
}
