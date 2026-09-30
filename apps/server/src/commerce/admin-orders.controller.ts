import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { OrdersService } from './orders.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  @Permissions('orders.read')
  list(@AdminMarketCode() market: MarketCode, @Query() query: unknown) {
    return this.ordersService.listAdmin(query, market);
  }

  @Get('orders/:id')
  @Permissions('orders.read')
  get(@Param('id') id: string) {
    return this.ordersService.getAdmin(id);
  }

  @Patch('orders/:id/status')
  @Permissions('orders.update')
  updateStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.ordersService.updateStatusAdmin(id, body);
  }

  @Patch('orders/:id/lock')
  @Permissions('orders.update')
  setLock(@Param('id') id: string, @Body() body: unknown) {
    return this.ordersService.setLockAdmin(id, body);
  }

  @Post('orders/:id/cancel')
  @Permissions('orders.update')
  cancel(@Param('id') id: string, @Body() body: unknown) {
    return this.ordersService.cancelByAdmin(id, body);
  }

  @Post('orders/:id/refund')
  @Permissions('orders.update')
  refund(@Param('id') id: string, @Body() body: unknown) {
    return this.ordersService.refundByAdmin(id, body);
  }
}
