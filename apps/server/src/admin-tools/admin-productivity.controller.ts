import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import type { RequestUser } from '../auth/auth.types';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { AdminProductivityService } from './admin-productivity.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminProductivityController {
  constructor(private readonly service: AdminProductivityService) {}

  @Get('catalog-completeness')
  @Permissions('products.read')
  catalogCompleteness(@AdminMarketCode() market: MarketCode) {
    return this.service.catalogCompleteness(market);
  }

  @Get('operations-dashboard')
  @Permissions('analytics.read')
  operationsDashboard(@AdminMarketCode() market: MarketCode) {
    return this.service.operationsDashboard(market);
  }

  @Get('saved-filters')
  @Permissions('products.read')
  savedFilters(@AdminMarketCode() market: MarketCode, @CurrentUser() user: RequestUser, @Query('entity') entity?: string) {
    return this.service.listSavedFilters(market, user.sub, entity ?? '');
  }

  @Post('saved-filters')
  @Permissions('products.read')
  saveFilter(@AdminMarketCode() market: MarketCode, @CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.service.saveFilter(market, user.sub, body);
  }

  @Delete('saved-filters/:id')
  @Permissions('products.read')
  deleteFilter(@AdminMarketCode() market: MarketCode, @CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.deleteFilter(market, user.sub, id);
  }

  @Get('change-history')
  @Permissions('analytics.read')
  history(@AdminMarketCode() market: MarketCode, @Query() query: { entityType?: string; field?: string; take?: string }) {
    return this.service.listHistory(market, query);
  }
}
