import { Controller, Get, Param, Put, Query, Body, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { MerchandisingService } from './merchandising.service';

@Controller('admin/merchandising')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminMerchandisingController {
  constructor(private readonly merchandisingService: MerchandisingService) {}

  @Get('rails')
  @Permissions('products.read')
  listRails(@AdminMarketCode() market: MarketCode) {
    return this.merchandisingService.listAdminRails(market);
  }

  @Put('rails/:rail')
  @Permissions('products.update')
  replaceRail(
    @AdminMarketCode() market: MarketCode,
    @Param('rail') rail: string,
    @Body() body: unknown,
  ) {
    return this.merchandisingService.replaceRail(rail, body, market);
  }

  @Get('search-insights')
  @Permissions('analytics.read')
  searchInsights(
    @AdminMarketCode() market: MarketCode,
    @Query('limit') limit?: string,
  ) {
    return this.merchandisingService.listSearchInsights(
      limit ? Number(limit) : 50,
      market,
    );
  }
}
