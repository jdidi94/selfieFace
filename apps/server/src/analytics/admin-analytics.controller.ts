import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions('analytics.read')
  dashboard(@AdminMarketCode() market: MarketCode, @Query() query: unknown) {
    return this.analyticsService.getDashboard(query, market);
  }

  @Get('analytics')
  @Permissions('analytics.read')
  analytics(@AdminMarketCode() market: MarketCode, @Query() query: unknown) {
    return this.analyticsService.getAnalytics(query, market);
  }
}
