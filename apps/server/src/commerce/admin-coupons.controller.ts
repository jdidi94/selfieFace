import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { MarketCode } from '@lumea/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import { CouponsService } from './coupons.service';

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @Permissions('coupons.read')
  list(@AdminMarketCode() market: MarketCode) {
    return this.couponsService.listAdmin(market);
  }

  @Get(':id')
  @Permissions('coupons.read')
  get(@Param('id') id: string) {
    return this.couponsService.getAdmin(id);
  }

  @Post()
  @Permissions('coupons.create')
  create(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.couponsService.create(body, market);
  }

  @Patch(':id')
  @Permissions('coupons.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.couponsService.update(id, body);
  }

  @Delete(':id')
  @Permissions('coupons.delete')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }

  @Post(':id/copy-to-market')
  @Permissions('coupons.create')
  copyToMarket(@Param('id') id: string, @Body() body: unknown) {
    return this.couponsService.copyToMarket(id, body);
  }
}
