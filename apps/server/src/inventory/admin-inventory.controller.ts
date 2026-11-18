import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { InventoryService } from './inventory.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('inventory')
  @Permissions('inventory.read')
  list(@AdminMarketCode() market: MarketCode) {
    return this.inventoryService.list(market);
  }

  @Patch('variants/:id/inventory')
  @Permissions('inventory.update')
  adjust(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: RequestUser) {
    return this.inventoryService.adjust(id, body, user.sub);
  }

  @Post('inventory/transfer')
  @Permissions('inventory.update')
  transfer(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    return this.inventoryService.transfer(body, user.sub);
  }
}
