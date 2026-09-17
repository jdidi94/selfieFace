import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Body,
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
import { PromotionsService } from './promotions.service';

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminPromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @Permissions('coupons.read')
  list(@AdminMarketCode() market: MarketCode) {
    return this.promotionsService.listAdmin(market);
  }

  @Get(':id')
  @Permissions('coupons.read')
  get(@Param('id') id: string) {
    return this.promotionsService.getAdmin(id);
  }

  @Post()
  @Permissions('coupons.create')
  create(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.promotionsService.create(body, market);
  }

  @Patch(':id')
  @Permissions('coupons.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.promotionsService.update(id, body);
  }

  @Delete(':id')
  @Permissions('coupons.delete')
  async remove(@Param('id') id: string) {
    await this.promotionsService.remove(id);
    return { ok: true };
  }
}
