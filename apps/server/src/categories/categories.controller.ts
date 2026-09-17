import { Controller, Get, Query } from '@nestjs/common';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @HttpCache(300)
  list(@Query('locale') locale?: string, @Query('currency') currency?: string) {
    return this.categoriesService.listPublic(locale ?? 'en', currency);
  }
}
