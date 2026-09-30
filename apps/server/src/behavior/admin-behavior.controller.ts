import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { BehaviorService } from './behavior.service';

@Controller('admin/behavior')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminBehaviorController {
  constructor(private readonly behaviorService: BehaviorService) {}

  @Get('stats')
  @Permissions('analytics.read')
  stats(@AdminMarketCode() market: MarketCode, @Query() query: unknown) {
    return this.behaviorService.getAdminStats(query, market);
  }
}
