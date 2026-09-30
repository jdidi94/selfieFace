import { Controller, Get, Query } from '@nestjs/common';
import { HttpCache } from '../common/interceptors/http-cache-headers.interceptor';
import { BannersService } from './banners.service';
import { FaqService } from './faq.service';
import { LegalDocumentsService } from './legal-documents.service';

@Controller('content')
export class ContentController {
  constructor(
    private readonly bannersService: BannersService,
    private readonly faqService: FaqService,
    private readonly legalDocuments: LegalDocumentsService,
  ) {}

  @Get('banners')
  @HttpCache(300)
  banners(@Query() query: Record<string, string>) {
    return this.bannersService.listPublic(query);
  }

  @Get('faq')
  @HttpCache(300)
  faq(@Query() query: Record<string, string>) {
    return this.faqService.listPublic(query);
  }

  @Get('legal')
  legal(@Query() query: Record<string, string>) {
    return this.legalDocuments.getPublic(query);
  }
}
