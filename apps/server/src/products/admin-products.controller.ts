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
import { ProductsService } from './products.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, UserTypesGuard, PermissionsGuard)
@UserTypes(UserType.ADMIN)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions('products.read')
  list(@Query() query: unknown, @AdminMarketCode() market: MarketCode) {
    return this.productsService.listAdmin({
      ...(typeof query === 'object' && query ? query : {}),
      market,
    });
  }

  @Post('bulk-tags')
  @Permissions('products.update')
  bulkTags(@Body() body: unknown) {
    return this.productsService.bulkTags(body);
  }

  @Get(':id')
  @Permissions('products.read')
  get(@Param('id') id: string, @AdminMarketCode() market: MarketCode) {
    return this.productsService.getAdmin(id, undefined, market);
  }

  @Post()
  @Permissions('products.create')
  create(@AdminMarketCode() market: MarketCode, @Body() body: unknown) {
    return this.productsService.create(body, market);
  }

  @Patch(':id')
  @Permissions('products.update')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.productsService.update(id, body);
  }

  @Delete(':id')
  @Permissions('products.delete')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/copy-to-market')
  @Permissions('products.create')
  copyToMarket(@Param('id') id: string, @Body() body: unknown) {
    return this.productsService.copyToMarket(id, body);
  }
}
