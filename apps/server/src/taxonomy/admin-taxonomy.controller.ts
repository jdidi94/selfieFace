import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AdminMarketCode } from '../markets/admin-market.decorator';
import type { MarketCode } from '@lumea/types';
import { TaxonomyAdminService, TaxonomyKind } from './taxonomy-admin.service';

@Controller('admin/taxonomy')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminTaxonomyController {
  constructor(private readonly service: TaxonomyAdminService) {}

  @Get(':kind')
  @Permissions('products.read')
  list(@Param('kind') kind: string, @AdminMarketCode() market: MarketCode) {
    return this.service.list(kind, market);
  }

  @Post(':kind')
  @Permissions('products.update')
  create(@Param('kind') kind: string, @AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.service.create(kind, market, body);
  }

  @Patch(':kind/:id')
  @Permissions('products.update')
  update(@Param('kind') kind: string, @Param('id') id: string, @Body() body: unknown) {
    return this.service.update(kind, id, body);
  }

  @Delete(':kind/:id')
  @Permissions('products.delete')
  remove(@Param('kind') kind: string, @Param('id') id: string) {
    return this.service.remove(kind, id);
  }
}
