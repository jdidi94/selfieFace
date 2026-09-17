import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { WarehousesService } from './warehouses.service';

@Controller('admin/warehouses')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminWarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @Permissions('inventory.read')
  list(@AdminMarketCode() market: MarketCode) {
    return this.warehousesService.list(market);
  }

  @Post()
  @Permissions('inventory.update')
  create(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.warehousesService.create(body, market);
  }

  @Patch(':id')
  @Permissions('inventory.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.warehousesService.update(id, body);
  }
}
