import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { FaqService } from './faq.service';

@Controller('admin/faq')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminFaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @Permissions('content.read')
  list(@AdminMarketCode() market: MarketCode) {
    return this.faqService.listAdmin(market);
  }

  @Get(':id')
  @Permissions('content.read')
  get(@Param('id') id: string) {
    return this.faqService.getAdmin(id);
  }

  @Post()
  @Permissions('content.create')
  create(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.faqService.create(body, market);
  }

  @Patch(':id')
  @Permissions('content.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.faqService.update(id, body);
  }

  @Delete(':id')
  @Permissions('content.update')
  remove(@Param('id') id: string) {
    return this.faqService.remove(id);
  }
}
