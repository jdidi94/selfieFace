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
import { CheckoutRealtimeService } from './checkout-realtime.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminSettingsController {
  constructor(
    private readonly settingsService: StoreSettingsService,
    private readonly checkoutRealtime: CheckoutRealtimeService,
  ) {}

  @Get()
  @Permissions('orders.read')
  get(@AdminMarketCode() market: MarketCode) {
    return this.settingsService.getDto(market);
  }

  @Patch()
  @Permissions('orders.update')
  async update(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    const result = await this.settingsService.update(body, market);
    this.checkoutRealtime.settingsChanged(market);
    return result;
  }
}
