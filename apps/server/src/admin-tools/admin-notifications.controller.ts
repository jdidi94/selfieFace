import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { AdminNotificationsService } from './admin-notifications.service';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService) {}

  @Get()
  @Permissions('analytics.read')
  list(@AdminMarketCode() market: MarketCode, @Query('status') status?: string) { return this.service.list(market, status); }

  @Patch(':id')
  @Permissions('orders.update')
  update(@AdminMarketCode() market: MarketCode, @Param('id') id: string, @Body() body: { status?: string }) { return this.service.setStatus(market, id, body.status ?? 'READ'); }

  @Post('analyze')
  @Permissions('analytics.read')
  analyze(@AdminMarketCode() market: MarketCode) { return this.service.analyze(market); }
}
