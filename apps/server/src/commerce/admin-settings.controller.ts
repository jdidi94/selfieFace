import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { StoreSettingsService } from './store-settings.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminSettingsController {
  constructor(private readonly settingsService: StoreSettingsService) {}

  @Get()
  @Permissions('orders.read')
  get(@AdminMarketCode() market: MarketCode) {
    return this.settingsService.getDto(market);
  }

  @Patch()
  @Permissions('orders.update')
  update(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.settingsService.update(body, market);
  }
}
