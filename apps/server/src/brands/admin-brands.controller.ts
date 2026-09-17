import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { BrandsService } from './brands.service';

@Controller('admin/brands')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminBrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Permissions('products.read')
  list(
    @AdminMarketCode() market: MarketCode,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) : 50;
    return this.brandsService.listAdmin(market, q, Number.isFinite(take) ? take : 50);
  }

  @Post()
  @Permissions('products.update')
  create(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.brandsService.create(body, market);
  }

  @Patch(':id')
  @Permissions('products.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.brandsService.update(id, body);
  }

  @Delete(':id')
  @Permissions('products.delete')
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }
}
