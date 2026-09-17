import { Controller, Get, Query } from '@nestjs/common';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { BannersService } from './banners.service';

@Controller('content')
export class ContentController {
  constructor(private readonly bannersService: BannersService) {}

  @Get('banners')
  @HttpCache(300)
  banners(@Query() query: Record<string, string>) {
    return this.bannersService.listPublic(query);
  }
}
