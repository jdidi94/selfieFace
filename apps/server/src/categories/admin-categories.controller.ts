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
import { CategoriesService } from './categories.service';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Permissions('products.read')
  list(@AdminMarketCode() market: MarketCode) {
    return this.categoriesService.listAdmin(market);
  }

  @Post()
  @Permissions('products.update')
  create(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.categoriesService.create(body, market);
  }

  @Patch(':id')
  @Permissions('products.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  @Permissions('products.delete')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  @Post(':id/copy-to-market')
  @Permissions('products.update')
  copyToMarket(@Param('id') id: string, @Body() body: unknown) {
    return this.categoriesService.copyToMarket(id, body);
  }
}
