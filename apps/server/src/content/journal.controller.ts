import { Controller, Get, Param, Query } from '@nestjs/common';
import { JournalService } from './journal.service';

@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.journalService.listPublic(query);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string, @Query() query: Record<string, string>) {
    return this.journalService.getBySlugPublic(slug, query);
  }
}
